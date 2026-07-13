"""
OCR fusion engine.

Relying on a single OCR engine caps accuracy at that engine's weaknesses. Fusion
runs several engines and reconciles them:

  1. Cluster detections that refer to the same physical token (box IoU).
  2. Within a cluster, vote on the text by summed confidence per spelling.
  3. Boost confidence when independent engines agree; lightly penalise a token
     only one engine saw while others were looking (likely spurious).

This "confidence voting" is a major accuracy differentiator over single-engine
OCR — e.g. Paddle reads "INVO1CE", Tesseract reads "INVOICE"; the agreeing,
higher-confidence spelling wins.
"""

from __future__ import annotations

import re

from app.contracts.ocr import OcrWord
from app.services.ocr.config import OcrConfig
from app.services.ocr.engines.base import RawWord

_NORM_STRIP = re.compile(r"^[^0-9A-Za-z]+|[^0-9A-Za-z]+$")


def _norm(text: str) -> str:
    """Normalise for equality voting (case + surrounding punctuation)."""
    return _NORM_STRIP.sub("", text).casefold()


class FusionEngine:
    def __init__(self, config: OcrConfig) -> None:
        self.config = config

    def fuse(self, per_engine: dict[str, list[RawWord]]) -> list[OcrWord]:
        """Merge per-engine words into a single reconciled word list."""
        engines_ran = [e for e, w in per_engine.items() if w is not None]
        # Flatten with engine tags.
        tagged: list[tuple[str, RawWord]] = [
            (engine, word)
            for engine, words in per_engine.items()
            for word in (words or [])
        ]
        if not tagged:
            return []

        # Single engine → nothing to reconcile, pass through unchanged.
        if len(engines_ran) == 1:
            engine = engines_ran[0]
            return [
                OcrWord(
                    text=w.text,
                    confidence=min(w.confidence, self.config.max_confidence),
                    box=w.box,
                    engine=engine,
                    agreed_by=(engine,),
                )
                for w in (per_engine[engine] or [])
            ]

        # Greedy clustering: most-confident detections seed clusters.
        order = sorted(
            range(len(tagged)),
            key=lambda i: (tagged[i][1].confidence, tagged[i][1].box.area),
            reverse=True,
        )
        assigned = [False] * len(tagged)
        fused: list[OcrWord] = []

        for i in order:
            if assigned[i]:
                continue
            assigned[i] = True
            seed_engine, seed_word = tagged[i]
            cluster = [(seed_engine, seed_word)]
            cluster_engines = {seed_engine}

            for j in order:
                if assigned[j]:
                    continue
                cand_engine, cand_word = tagged[j]
                # One detection per engine per cluster (avoid self-merging).
                if cand_engine in cluster_engines:
                    continue
                if seed_word.box.iou(cand_word.box) >= self.config.fusion_iou_threshold:
                    assigned[j] = True
                    cluster.append((cand_engine, cand_word))
                    cluster_engines.add(cand_engine)

            fused.append(self._reconcile(cluster, len(engines_ran)))

        return fused

    def _reconcile(
        self,
        cluster: list[tuple[str, RawWord]],
        engines_ran: int,
    ) -> OcrWord:
        # Vote: summed confidence per normalised spelling.
        weight: dict[str, float] = {}
        voters: dict[str, set[str]] = {}
        for engine, word in cluster:
            key = _norm(word.text)
            weight[key] = weight.get(key, 0.0) + word.confidence
            voters.setdefault(key, set()).add(engine)

        winner_key = max(
            weight,
            key=lambda k: (weight[k], len(voters[k])),
        )
        winner_voters = voters[winner_key]

        # Best-confidence member carrying the winning spelling → text + box.
        best_engine, best_word = max(
            (m for m in cluster if _norm(m[1].text) == winner_key),
            key=lambda m: m[1].confidence,
        )

        base = best_word.confidence
        agreement = len(winner_voters)
        if agreement >= 2:
            conf = base + self.config.agreement_bonus * (agreement - 1)
        elif engines_ran >= 2:
            # Only one engine saw this token although others were running.
            conf = base * (1.0 - self.config.singleton_penalty)
        else:
            conf = base

        return OcrWord(
            text=best_word.text,
            confidence=max(0.0, min(conf, self.config.max_confidence)),
            box=best_word.box,
            engine=best_engine,
            agreed_by=tuple(sorted(winner_voters)),
        )
