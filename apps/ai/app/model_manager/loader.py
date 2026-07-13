from app.model_manager.models import AIModel
from app.model_manager.registry import get_registry


class ModelLoader:

    def __init__(self):

        self.registry = get_registry()

    def load(
        self,
        model: AIModel,
    ):

        if self.registry.exists(model):

            return self.registry.get(model)

        #
        # Real loading later
        #

        instance = object()

        self.registry.register(
            model,
            instance,
        )

        return instance