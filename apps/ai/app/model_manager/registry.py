from typing import Any

from app.model_manager.models import AIModel


class ModelRegistry:

    """
    Singleton registry containing every loaded AI model.
    """

    def __init__(self):

        self._models: dict[AIModel, Any] = {}

    def register(
        self,
        model: AIModel,
        instance: Any,
    ) -> None:

        self._models[model] = instance

    def get(
        self,
        model: AIModel,
    ):

        return self._models.get(model)

    def exists(
        self,
        model: AIModel,
    ) -> bool:

        return model in self._models

    def unload(
        self,
        model: AIModel,
    ):

        self._models.pop(model, None)

    def clear(self):

        self._models.clear()

    def list_models(self):

        return list(self._models.keys())


_registry = ModelRegistry()


def get_registry() -> ModelRegistry:

    return _registry