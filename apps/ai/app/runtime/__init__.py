"""
AI Runtime — the execution operating system for every AI capability.

Business logic depends only on ``AIRuntime`` + the contracts here; concrete
models plug in as ``RuntimeModel`` descriptors in the Model Registry v2.
"""

from app.runtime.config import RuntimeConfig, get_runtime_config
from app.runtime.contracts import (
    Device,
    ExecutionResult,
    ModelDescriptor,
    ModelStatus,
    Task,
)
from app.runtime.engine import AIRuntime, get_ai_runtime
from app.runtime.model import RuntimeModel
from app.runtime.registry import ModelRegistry, get_model_registry

__all__ = [
    "AIRuntime",
    "get_ai_runtime",
    "RuntimeModel",
    "ModelRegistry",
    "get_model_registry",
    "ModelDescriptor",
    "ExecutionResult",
    "Task",
    "Device",
    "ModelStatus",
    "RuntimeConfig",
    "get_runtime_config",
]
