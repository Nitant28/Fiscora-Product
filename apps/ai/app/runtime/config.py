"""
AI Runtime configuration.

All execution policy (retries, timeouts, warm-model capacity, device) lives here
so behaviour is tunable per deployment and unit-testable — never hard-coded in
the runtime engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from app.core.config import get_settings


@dataclass(frozen=True, slots=True)
class RuntimeConfig:
    # Total attempts = 1 + retries on transient failures/timeouts.
    max_retries: int = 1
    retry_backoff_ms: int = 50  # linear backoff * attempt
    # Per-inference wall-clock budget. <=0 disables the timeout guard.
    timeout_s: float = 30.0
    # Max simultaneously-warm model instances; LRU-evicted beyond this.
    max_warm_models: int = 3
    enable_warmup: bool = True
    default_device: str = "cpu"
    # Worker threads backing the timeout guard.
    max_workers: int = 4

    @property
    def max_attempts(self) -> int:
        return 1 + max(0, self.max_retries)


@lru_cache
def get_runtime_config() -> RuntimeConfig:
    settings = get_settings()
    return RuntimeConfig(
        max_warm_models=settings.MAX_MODELS_IN_MEMORY,
        default_device=settings.DEVICE,
    )
