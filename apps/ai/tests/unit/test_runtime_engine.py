"""Unit tests for the AI Runtime execution engine."""

from __future__ import annotations

import time

import pytest

from app.runtime.config import RuntimeConfig
from app.runtime.contracts import ModelDescriptor, ModelStatus, Task
from app.runtime.engine import AIRuntime
from app.runtime.exceptions import ExecutionExhausted, NoModelForTask
from app.runtime.model import RuntimeModel
from app.runtime.registry import ModelRegistry


class Doubler(RuntimeModel):
    def predict(self, inputs):
        return inputs * 2


class Flaky(RuntimeModel):
    """Fails ``fail_times`` then succeeds."""

    def __init__(self, fail_times: int) -> None:
        self.calls = 0
        self.fail_times = fail_times

    def predict(self, inputs):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise ValueError("transient")
        return inputs


class Slow(RuntimeModel):
    def predict(self, inputs):
        time.sleep(0.5)
        return inputs


def _fast_config(**kw) -> RuntimeConfig:
    base = dict(max_retries=0, retry_backoff_ms=0, timeout_s=5.0, enable_warmup=True)
    base.update(kw)
    return RuntimeConfig(**base)


def _runtime(cfg: RuntimeConfig | None = None) -> tuple[AIRuntime, ModelRegistry]:
    reg = ModelRegistry()
    return AIRuntime(registry=reg, config=cfg or _fast_config()), reg


def _register(reg, name, factory, priority=100, task=Task.OCR, available=True):
    reg.register(
        ModelDescriptor(
            name=name,
            version="1.0",
            task=task,
            factory=factory,
            priority=priority,
            availability=lambda: available,
        )
    )


def test_execute_happy_path() -> None:
    rt, reg = _runtime()
    _register(reg, "double", lambda: Doubler())
    result = rt.execute(Task.OCR, 21, model="double")
    assert result.output == 42
    assert result.attempts == 1
    assert result.reused_warm is False
    assert result.model == "double"


def test_warm_instance_is_reused() -> None:
    rt, reg = _runtime()
    builds = {"n": 0}

    def factory():
        builds["n"] += 1
        return Doubler()

    _register(reg, "double", factory)
    first = rt.execute(Task.OCR, 1, model="double")
    second = rt.execute(Task.OCR, 2, model="double")
    assert builds["n"] == 1  # loaded once, then reused
    assert first.reused_warm is False
    assert second.reused_warm is True


def test_retries_then_succeeds() -> None:
    rt, reg = _runtime(_fast_config(max_retries=2))
    _register(reg, "flaky", lambda: Flaky(fail_times=1))
    result = rt.execute(Task.OCR, "ok", model="flaky")
    assert result.output == "ok"
    assert result.attempts == 2


def test_permanent_failure_exhausts_and_marks_health() -> None:
    rt, reg = _runtime(_fast_config(max_retries=1))
    _register(reg, "broken", lambda: Flaky(fail_times=99))
    with pytest.raises(ExecutionExhausted):
        rt.execute(Task.OCR, "x", model="broken")
    rec = rt.health.get("broken")
    assert rec is not None and rec.failures >= 2


def test_timeout_is_enforced() -> None:
    rt, reg = _runtime(_fast_config(timeout_s=0.05))
    _register(reg, "slow", lambda: Slow())
    with pytest.raises(ExecutionExhausted):
        rt.execute(Task.OCR, "x", model="slow")


def test_lru_eviction_unloads_oldest() -> None:
    rt, reg = _runtime(_fast_config(max_warm_models=1))
    unloaded: list[str] = []

    class Tracked(RuntimeModel):
        def __init__(self, tag):
            self.tag = tag

        def predict(self, inputs):
            return self.tag

        def unload(self):
            unloaded.append(self.tag)

    _register(reg, "A", lambda: Tracked("A"))
    _register(reg, "B", lambda: Tracked("B"))
    rt.execute(Task.OCR, 0, model="A")
    rt.execute(Task.OCR, 0, model="B")  # capacity 1 → evict A
    assert unloaded == ["A"]


def test_resolve_by_task_with_prefer() -> None:
    rt, reg = _runtime()
    _register(reg, "first", lambda: Doubler(), priority=10)
    _register(reg, "second", lambda: Doubler(), priority=20)
    result = rt.execute(Task.OCR, 5, prefer=["second"])
    assert result.model == "second"


def test_no_model_for_task_raises() -> None:
    rt, _ = _runtime()
    with pytest.raises(NoModelForTask):
        rt.execute(Task.VISION, "x")


def test_health_report_shape() -> None:
    rt, reg = _runtime()
    _register(reg, "double", lambda: Doubler())
    rt.execute(Task.OCR, 2, model="double")
    report = rt.health_report()
    assert report["double"]["status"] == ModelStatus.HEALTHY.value
    assert report["double"]["calls"] == 1
