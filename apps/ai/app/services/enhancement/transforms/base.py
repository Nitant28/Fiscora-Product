"""
Base class for image transforms.

Contract: a transform takes a BGR uint8 image and returns a BGR uint8 image of
the same dtype. Transforms are independent, stateless and named so the pipeline
can select them by name from a decision plan.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class ImageTransform(ABC):
    #: Stable identifier used in decision plans, telemetry and the registry.
    name: str = "transform"

    @abstractmethod
    def apply(self, image: np.ndarray) -> np.ndarray:
        raise NotImplementedError

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"<{type(self).__name__} name={self.name!r}>"
