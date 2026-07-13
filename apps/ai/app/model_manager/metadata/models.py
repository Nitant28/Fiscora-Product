from enum import Enum
from dataclasses import dataclass


class ModelType(str, Enum):

    PADDLE = "paddle"

    SURYA = "surya"

    DOCLAYOUT = "doclayout"

    QWEN = "qwen"

    FLORENCE = "florence"

    GEMINI = "gemini"


@dataclass(frozen=True)
class ModelMetadata:

    name: str

    huggingface_repo: str | None

    gpu_required: bool

    supports_batching: bool