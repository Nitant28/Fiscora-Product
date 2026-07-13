from app.model_manager.models import AIModel
from app.model_manager.registry import get_registry


class ModelHealth:

    def __init__(self):

        self.registry = get_registry()

    def status(self):

        return {

            model.value: self.registry.exists(model)

            for model in AIModel

        }