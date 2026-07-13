"""
Document Knowledge Graph — the single source of truth downstream stages consume.

Rule 4 of the platform directive: *never pass OCR text directly into extraction*.
Instead, OCR words, lines, (later) layout regions and tables become **nodes**, and
their spatial/structural relationships become **edges**. Extraction, validation,
and explainability all reason over this graph rather than raw strings, so the
system stays model-agnostic (any OCR/layout engine that fills the graph works)
and every value can be traced back to the nodes that produced it.

The graph is deliberately dependency-free (pure dataclasses) and serialisable via
``as_dict`` for storage / the explainability UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Optional

from app.contracts.ocr import BoundingBox, OcrContract


class NodeKind(str, Enum):
    PAGE = "page"
    LINE = "line"
    WORD = "word"
    REGION = "region"  # populated later by Layout Intelligence
    TABLE = "table"
    CELL = "cell"


class Relation(str, Enum):
    CONTAINS = "contains"          # page -> line -> word
    LEFT_OF = "left_of"            # word ordering within a line
    BELOW = "below"                # line -> next line (reading flow)
    HEADER_OF = "header_of"        # region/table header linkage (future)
    CELL_OF = "cell_of"            # cell -> table (future)
    LINE_ITEM_OF = "line_item_of"  # row -> table (future)


@dataclass(slots=True)
class GraphNode:
    id: str
    kind: NodeKind
    text: str
    page: int
    confidence: float
    box: Optional[BoundingBox] = None
    # Which engines produced/agreed on this node's content (provenance).
    sources: tuple[str, ...] = ()
    # Free-form attributes (layout label, region type, etc.).
    attrs: dict[str, object] = field(default_factory=dict)

    def as_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "kind": self.kind.value,
            "text": self.text,
            "page": self.page,
            "confidence": round(self.confidence, 4),
            "box": self.box.as_list() if self.box else None,
            "sources": list(self.sources),
            "attrs": self.attrs,
        }


@dataclass(slots=True)
class GraphEdge:
    src: str
    relation: Relation
    dst: str

    def as_dict(self) -> dict[str, object]:
        return {"src": self.src, "rel": self.relation.value, "dst": self.dst}


@dataclass(slots=True)
class DocumentGraph:
    document_id: str
    page_count: int
    nodes: dict[str, GraphNode] = field(default_factory=dict)
    edges: list[GraphEdge] = field(default_factory=list)
    # Adjacency cache: (src_id, relation) -> [dst_id, ...]
    _adj: dict[tuple[str, Relation], list[str]] = field(default_factory=dict)

    # ------------------------------------------------------------------ build
    def add_node(self, node: GraphNode) -> GraphNode:
        self.nodes[node.id] = node
        return node

    def add_edge(self, src: str, relation: Relation, dst: str) -> None:
        self.edges.append(GraphEdge(src, relation, dst))
        self._adj.setdefault((src, relation), []).append(dst)

    # --------------------------------------------------------------- queries
    def neighbors(self, node_id: str, relation: Relation) -> list[GraphNode]:
        return [self.nodes[d] for d in self._adj.get((node_id, relation), []) if d in self.nodes]

    def by_kind(self, kind: NodeKind) -> list[GraphNode]:
        return [n for n in self.nodes.values() if n.kind == kind]

    @property
    def lines(self) -> list[GraphNode]:
        return self.by_kind(NodeKind.LINE)

    @property
    def words(self) -> list[GraphNode]:
        return self.by_kind(NodeKind.WORD)

    def line_words(self, line_id: str) -> list[GraphNode]:
        """Words of a line, left-to-right."""
        words = self.neighbors(line_id, Relation.CONTAINS)
        return sorted(words, key=lambda w: (w.box.x if w.box else 0))

    def line_below(self, line_id: str) -> Optional[GraphNode]:
        below = self.neighbors(line_id, Relation.BELOW)
        return below[0] if below else None

    @property
    def text(self) -> str:
        return "\n".join(n.text for n in self.lines)

    def as_dict(self) -> dict[str, object]:
        return {
            "document_id": self.document_id,
            "page_count": self.page_count,
            "node_count": len(self.nodes),
            "edge_count": len(self.edges),
            "nodes": [n.as_dict() for n in self.nodes.values()],
            "edges": [e.as_dict() for e in self.edges],
        }


def build_graph(document_id: str, ocr: OcrContract) -> DocumentGraph:
    """Construct a :class:`DocumentGraph` from an :class:`OcrContract`.

    Establishes structural containment (page→line→word) and reading-flow edges
    (``left_of`` between consecutive words, ``below`` between consecutive lines).
    Layout Intelligence will later attach ``REGION``/``TABLE`` nodes and richer
    relations onto the same graph without changing this builder's contract.
    """
    graph = DocumentGraph(document_id=document_id, page_count=len(ocr.pages))

    for page in ocr.pages:
        page_id = f"page:{page.page_number}"
        graph.add_node(
            GraphNode(
                id=page_id,
                kind=NodeKind.PAGE,
                text="",
                page=page.page_number,
                confidence=page.confidence,
                box=BoundingBox(0, 0, page.width, page.height),
            )
        )

        prev_line_id: Optional[str] = None
        for li, line in enumerate(page.lines):
            line_id = f"line:{page.page_number}:{li}"
            sources = _line_sources(line)
            graph.add_node(
                GraphNode(
                    id=line_id,
                    kind=NodeKind.LINE,
                    text=line.text,
                    page=page.page_number,
                    confidence=line.confidence,
                    box=line.box,
                    sources=sources,
                )
            )
            graph.add_edge(page_id, Relation.CONTAINS, line_id)
            if prev_line_id is not None:
                graph.add_edge(prev_line_id, Relation.BELOW, line_id)
            prev_line_id = line_id

            prev_word_id: Optional[str] = None
            for wi, word in enumerate(line.words):
                word_id = f"word:{page.page_number}:{li}:{wi}"
                graph.add_node(
                    GraphNode(
                        id=word_id,
                        kind=NodeKind.WORD,
                        text=word.text,
                        page=page.page_number,
                        confidence=word.confidence,
                        box=word.box,
                        sources=tuple(word.agreed_by) or (word.engine,),
                    )
                )
                graph.add_edge(line_id, Relation.CONTAINS, word_id)
                if prev_word_id is not None:
                    graph.add_edge(prev_word_id, Relation.LEFT_OF, word_id)
                prev_word_id = word_id

    return graph


def _line_sources(line) -> tuple[str, ...]:
    seen: list[str] = []
    for w in line.words:
        for s in (tuple(w.agreed_by) or (w.engine,)):
            if s and s not in seen:
                seen.append(s)
    return tuple(seen)
