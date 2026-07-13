"""Typed errors for the AI Runtime."""

from __future__ import annotations


class RuntimeError_(Exception):
    """Base class for all AI-runtime failures (underscored to avoid shadowing
    the builtin ``RuntimeError``)."""


class ModelNotRegistered(RuntimeError_):
    def __init__(self, name: str) -> None:
        super().__init__(f"No model registered under '{name}'")
        self.name = name


class NoModelForTask(RuntimeError_):
    def __init__(self, task: str) -> None:
        super().__init__(f"No available model can serve task '{task}'")
        self.task = task


class ModelLoadError(RuntimeError_):
    def __init__(self, name: str, message: str) -> None:
        super().__init__(f"Failed to load model '{name}': {message}")
        self.name = name


class InferenceTimeout(RuntimeError_):
    def __init__(self, name: str, timeout_s: float) -> None:
        super().__init__(f"Model '{name}' exceeded {timeout_s}s timeout")
        self.name = name
        self.timeout_s = timeout_s


class InferenceError(RuntimeError_):
    def __init__(self, name: str, message: str) -> None:
        super().__init__(f"Model '{name}' inference failed: {message}")
        self.name = name


class ExecutionExhausted(RuntimeError_):
    """All retry attempts were used without a successful inference."""

    def __init__(self, name: str, attempts: int, last_error: str) -> None:
        super().__init__(
            f"Model '{name}' failed after {attempts} attempt(s): {last_error}"
        )
        self.name = name
        self.attempts = attempts
        self.last_error = last_error
