from enum import Enum


class AIModel(str, Enum):

    PADDLE = "paddle"

    TESSERACT = "tesseract"

    SURYA = "surya"

    DOCLAYOUT = "doclayout"

    QWEN = "qwen"

    GEMINI = "gemini"

    OPENAI = "openai"