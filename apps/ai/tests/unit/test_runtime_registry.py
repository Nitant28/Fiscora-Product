"""Unit tests for the Model Registry v2."""

from __future__ import annotations

import pytest

from app.runtime.contracts import ModelDescriptor, Task
from app.runtime.exceptions import ModelNotRegistered
from app.runtime.registry import ModelRegistry


def _desc(name: str, priority: int = 100, available: bool = True, task=Task.OCR):
    return ModelDescriptor(
        name=name,
        version="1.0",
        task=task,
        factory=lambda: object(),
        priority=priority,
        availability=lambda: available,
    )


def test_register_and_get() -> None:
    reg = ModelRegistry()
    reg.register(_desc("a"))
    assert reg.has("a")
    assert reg.get("a").name == "a"


def test_get_missing_raises() -> None:
    with pytest.raises(ModelNotRegistered):
        ModelRegistry().get("nope")


def test_find_orders_by_priority_and_filters_availability() -> None:
    reg = ModelRegistry()
    reg.register(_desc("slow", priority=30))
    reg.register(_desc("fast", priority=10))
    reg.register(_desc("down", priority=5, available=False))
    reg.register(_desc("vision", task=Task.VISION))

    found = reg.find(Task.OCR)
    names = [d.name for d in found]
    assert names == ["fast", "slow"]  # 'down' filtered, 'vision' wrong task


def test_find_filters_by_language() -> None:
    reg = ModelRegistry()
    reg.register(
        ModelDescriptor(
            name="en_only",
            version="1",
            task=Task.OCR,
            factory=lambda: object(),
            languages=("en",),
        )
    )
    assert reg.find(Task.OCR, language="fr") == []
    assert len(reg.find(Task.OCR, language="en")) == 1


def test_replace_false_keeps_first() -> None:
    reg = ModelRegistry()
    reg.register(_desc("a", priority=1))
    reg.register(_desc("a", priority=99), replace=False)
    assert reg.get("a").priority == 1
