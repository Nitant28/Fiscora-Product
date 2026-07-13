"""
Model Registry v2.

Stores rich ``ModelDescriptor`` metadata (version, framework, device,
capabilities, availability probe, priority) rather than bare instances, so the
runtime can *decide* which model to use for a task without loading anything.
"""

from __future__ import annotations

import threading

from app.core.logger import logger
from app.runtime.contracts import ModelDescriptor, Task
from app.runtime.exceptions import ModelNotRegistered


class ModelRegistry:
    def __init__(self) -> None:
        self._descriptors: dict[str, ModelDescriptor] = {}
        self._lock = threading.RLock()

    def register(self, descriptor: ModelDescriptor, *, replace: bool = True) -> None:
        with self._lock:
            if descriptor.name in self._descriptors and not replace:
                return
            self._descriptors[descriptor.name] = descriptor
            logger.info(
                "runtime.model_registered",
                model=descriptor.name,
                version=descriptor.version,
                task=descriptor.task.value,
            )

    def has(self, name: str) -> bool:
        return name in self._descriptors

    def get(self, name: str) -> ModelDescriptor:
        try:
            return self._descriptors[name]
        except KeyError as exc:
            raise ModelNotRegistered(name) from exc

    def find(
        self,
        task: Task,
        language: str | None = None,
        doc_type: str | None = None,
        only_available: bool = True,
    ) -> list[ModelDescriptor]:
        """All descriptors that can serve ``task``, best (lowest priority) first."""
        out = [
            d
            for d in self._descriptors.values()
            if d.serves(task, language, doc_type)
            and (not only_available or d.is_available())
        ]
        out.sort(key=lambda d: d.priority)
        return out

    def list(self) -> list[ModelDescriptor]:
        return list(self._descriptors.values())

    def clear(self) -> None:
        with self._lock:
            self._descriptors.clear()


_registry = ModelRegistry()


def get_model_registry() -> ModelRegistry:
    return _registry
