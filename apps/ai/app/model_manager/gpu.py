import torch


class GPUManager:

    @staticmethod
    def available():

        return torch.cuda.is_available()

    @staticmethod
    def device():

        return "cuda" if torch.cuda.is_available() else "cpu"

    @staticmethod
    def count():

        return torch.cuda.device_count()

    @staticmethod
    def name():

        if not torch.cuda.is_available():
            return None

        return torch.cuda.get_device_name(0)