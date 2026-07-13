# Models

This directory holds AI/ML model weights used by the Fiscora platform (OCR,
vision, extraction, etc.).

Model weight files are **intentionally not committed** to the repository. The
directory structure and this README are tracked via `.gitkeep`, but the actual
weights are ignored by `.gitignore`.

## Ignored weight formats

`*.pt`, `*.pth`, `*.onnx`, `*.bin`, `*.safetensors`, `*.ckpt`, `*.h5`, `*.gguf`

## Obtaining weights

Model weights are downloaded at build/runtime by the model manager rather than
being stored in version control. Refer to the AI service documentation
(`apps/ai/app/model_manager`) for how models are resolved and cached locally.
