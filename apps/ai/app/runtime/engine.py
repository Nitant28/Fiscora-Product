"""
AI Runtime — the execution engine that owns model lifecycle.

Golden rule: **business logic never calls a model directly**. It calls
``runtime.execute(task, inputs, model=...)`` and the runtime handles:

    resolve descriptor → lazy load → warmup → (timeout-guarded) predict
        → retries w/ backoff → telemetry + health → LRU memory management

This is the single seam that lets you upgrade PaddleOCR → a future model, swap
Gemini for another provider, A/B test versions, or run tenant-specific configs
without touching a single line of business code.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from time import perf_counter
from typing import Any

from app.core.logger import logger
from app.runtime.config import RuntimeConfig, get_runtime_config
from app.runtime.contracts import (
    Device,
    ExecutionResult,
    ModelDescriptor,
    ModelStatus,
    Task,
)
from app.runtime.exceptions import (
    ExecutionExhausted,
    InferenceError,
    InferenceTimeout,
    ModelLoadError,
    NoModelForTask,
)
from app.runtime.health import HealthTracker
from app.runtime.model import RuntimeModel
from app.runtime.registry import ModelRegistry, get_model_registry


class AIRuntime:
    def __init__(
        self,
        registry: ModelRegistry | None = None,
        config: RuntimeConfig | None = None,
        telemetry=None,
    ) -> None:
        self.registry = registry or get_model_registry()
        self.config = config or get_runtime_config()
        self.telemetry = telemetry
        self.health = HealthTracker()
        # Warm instances, ordered for LRU eviction (most-recent at the end).
        self._warm: "OrderedDict[str, RuntimeModel]" = OrderedDict()
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(
            max_workers=self.config.max_workers,
            thread_name_prefix="ai-runtime",
        )

    # ------------------------------------------------------------------ public
    def execute(
        self,
        task: Task,
        inputs: Any,
        model: str | None = None,
        prefer: list[str] | None = None,
        timeout_s: float | None = None,
    ) -> ExecutionResult:
        descriptor = self._resolve(task, model, prefer)
        instance, reused = self._acquire(descriptor)

        budget = self.config.timeout_s if timeout_s is None else timeout_s
        last_error = "unknown"

        for attempt in range(1, self.config.max_attempts + 1):
            start = perf_counter()
            try:
                output = self._run_guarded(descriptor.name, instance, inputs, budget)
                latency = (perf_counter() - start) * 1000.0
                self.health.on_success(descriptor.name, latency)
                self._emit(descriptor, latency, attempt, success=True)
                return ExecutionResult(
                    output=output,
                    model=descriptor.name,
                    version=descriptor.version,
                    task=task,
                    latency_ms=latency,
                    attempts=attempt,
                    reused_warm=reused,
                )
            except InferenceTimeout as exc:
                last_error = str(exc)
                self.health.on_failure(descriptor.name, last_error)
                logger.warning(
                    "runtime.timeout", model=descriptor.name, attempt=attempt
                )
            except Exception as exc:  # engine/model errors are retryable
                last_error = str(exc)
                self.health.on_failure(descriptor.name, last_error)
                logger.warning(
                    "runtime.inference_failed",
                    model=descriptor.name,
                    attempt=attempt,
                    error=last_error,
                )

            if attempt < self.config.max_attempts:
                self._backoff(attempt)

        self._emit(descriptor, 0.0, self.config.max_attempts, success=False)
        raise ExecutionExhausted(
            descriptor.name, self.config.max_attempts, last_error
        )

    def warmup(self, task: Task | None = None) -> None:
        """Pre-load + warm all available models (optionally for one task)."""
        for descriptor in self.registry.list():
            if task is not None and descriptor.task != task:
                continue
            if descriptor.is_available():
                try:
                    self._acquire(descriptor)
                except ModelLoadError as exc:
                    logger.warning("runtime.warmup_failed", model=descriptor.name, error=str(exc))

    def health_report(self) -> dict[str, dict[str, object]]:
        return self.health.snapshot()

    def unload(self, name: str) -> None:
        with self._lock:
            self._evict(name)

    def shutdown(self) -> None:
        with self._lock:
            for name in list(self._warm):
                self._evict(name)
        self._executor.shutdown(wait=False)

    # --------------------------------------------------------------- internals
    def _resolve(
        self, task: Task, model: str | None, prefer: list[str] | None
    ) -> ModelDescriptor:
        if model is not None:
            descriptor = self.registry.get(model)
            if not descriptor.is_available():
                raise NoModelForTask(f"{task.value} (model '{model}' unavailable)")
            return descriptor

        candidates = self.registry.find(task)
        if not candidates:
            raise NoModelForTask(task.value)
        if prefer:
            rank = {name: i for i, name in enumerate(prefer)}
            candidates.sort(key=lambda d: (rank.get(d.name, len(prefer)), d.priority))
        return candidates[0]

    def _acquire(self, descriptor: ModelDescriptor) -> tuple[RuntimeModel, bool]:
        with self._lock:
            existing = self._warm.get(descriptor.name)
            if existing is not None:
                self._warm.move_to_end(descriptor.name)
                return existing, True

            self.health.set_status(descriptor.name, ModelStatus.LOADING)
            try:
                instance = descriptor.factory()
                if not isinstance(instance, RuntimeModel):
                    raise TypeError("factory did not return a RuntimeModel")
                instance.load()
                if self.config.enable_warmup:
                    instance.warmup()
            except Exception as exc:
                self.health.set_status(descriptor.name, ModelStatus.FAILED)
                self.health.on_failure(descriptor.name, str(exc))
                raise ModelLoadError(descriptor.name, str(exc)) from exc

            self.health.on_load(descriptor.name)
            self.health.set_status(descriptor.name, ModelStatus.WARM)
            self._warm[descriptor.name] = instance
            self._warm.move_to_end(descriptor.name)
            self._enforce_capacity()
            return instance, False

    def _enforce_capacity(self) -> None:
        while len(self._warm) > self.config.max_warm_models:
            oldest, _ = next(iter(self._warm.items()))
            self._evict(oldest)

    def _evict(self, name: str) -> None:
        instance = self._warm.pop(name, None)
        if instance is None:
            return
        try:
            instance.unload()
        except Exception as exc:  # eviction must never crash the runtime
            logger.warning("runtime.unload_failed", model=name, error=str(exc))
        self.health.set_status(name, ModelStatus.UNLOADED)
        logger.info("runtime.model_evicted", model=name)

    def _run_guarded(
        self, name: str, instance: RuntimeModel, inputs: Any, budget: float
    ) -> Any:
        if budget is None or budget <= 0:
            return instance.predict(inputs)
        future = self._executor.submit(instance.predict, inputs)
        try:
            return future.result(timeout=budget)
        except FuturesTimeout as exc:
            # The worker thread may keep running; we surface a timeout so the
            # caller isn't blocked. (Cooperative cancellation is model-specific.)
            raise InferenceTimeout(name, budget) from exc

    def _backoff(self, attempt: int) -> None:
        delay = self.config.retry_backoff_ms * attempt / 1000.0
        if delay > 0:
            time.sleep(delay)

    def _emit(
        self,
        descriptor: ModelDescriptor,
        latency_ms: float,
        attempts: int,
        success: bool,
    ) -> None:
        if self.telemetry is None:
            return
        self.telemetry.record(
            f"runtime.{descriptor.task.value}",
            latency_ms,
            model=descriptor.name,
            metadata={
                "version": descriptor.version,
                "attempts": attempts,
                "success": success,
                "device": descriptor.device.value
                if isinstance(descriptor.device, Device)
                else str(descriptor.device),
            },
        )


_runtime: AIRuntime | None = None
_runtime_lock = threading.Lock()


def get_ai_runtime() -> AIRuntime:
    """Process-wide runtime singleton (thread-safe lazy init)."""
    global _runtime
    if _runtime is None:
        with _runtime_lock:
            if _runtime is None:
                _runtime = AIRuntime()
    return _runtime
