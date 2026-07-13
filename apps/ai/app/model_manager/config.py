from dataclasses import dataclass


@dataclass(frozen=True)
class ModelConfig:

    device: str

    cache_enabled: bool

    max_models: int

    use_fp16: bool

    download_dir: str