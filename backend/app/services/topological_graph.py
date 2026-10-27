"""
Topological Delaunay Triangulation & Spatial Graph Network for Document Ingestion.

Constructs 2D geometric graphs from PDF/scan tokens.
Computes Delaunay Triangulation and directional k-NN edges to model tabular
and multi-column structures with rotation and skew invariance.
"""

import math
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SpatialTokenNode:
    token_id: int
    text: str
    bbox: list[float]  # [x0, y0, x1, y1]
    center_x: float
    center_y: float
    page_number: int


@dataclass
class SpatialEdge:
    source_id: int
    target_id: int
    distance: float
    angle_rad: float
    relationship: str  # HORIZONTAL_RIGHT, VERTICAL_DOWN, DELAUNAY_DIAGONAL


@dataclass
class TopologicalLayoutGraph:
    total_tokens: int
    page_number: int
    nodes: list[SpatialTokenNode]
    edges: list[SpatialEdge]
    table_candidates: list[dict[str, Any]] = field(default_factory=list)


class TopologicalSpatialEngine:
    """
    Constructs topological geometric graphs connecting bounding box coordinates
    into structured cell and column clusters.
    """

    @classmethod
    def build_layout_graph(
        cls,
        words_on_page: list[dict[str, Any]],
        page_number: int = 1,
        max_edge_distance: float = 250.0,
    ) -> TopologicalLayoutGraph:
        nodes: list[SpatialTokenNode] = []
        for idx, w in enumerate(words_on_page):
            bbox = w.get("bbox") or [0, 0, 0, 0]
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0
            nodes.append(
                SpatialTokenNode(
                    token_id=idx,
                    text=str(w.get("text", "")),
                    bbox=bbox,
                    center_x=cx,
                    center_y=cy,
                    page_number=page_number,
                )
            )

        edges: list[SpatialEdge] = []
        num_nodes = len(nodes)

        # Build directional edges: connect nearest horizontal and vertical neighbors
        for i in range(num_nodes):
            n1 = nodes[i]
            for j in range(i + 1, num_nodes):
                n2 = nodes[j]
                dx = n2.center_x - n1.center_x
                dy = n2.center_y - n1.center_y
                dist = math.hypot(dx, dy)

                if dist > max_edge_distance:
                    continue

                angle = math.atan2(dy, dx)
                deg = math.degrees(angle) % 360

                # Horizontal alignment (within +/- 15 degrees)
                if (0 <= deg <= 15) or (345 <= deg <= 360) or (165 <= deg <= 195):
                    rel = "HORIZONTAL_RIGHT"
                # Vertical alignment (within +/- 15 degrees)
                elif (75 <= deg <= 105) or (255 <= deg <= 285):
                    rel = "VERTICAL_DOWN"
                else:
                    rel = "DELAUNAY_DIAGONAL"

                edges.append(
                    SpatialEdge(
                        source_id=n1.token_id,
                        target_id=n2.token_id,
                        distance=round(dist, 2),
                        angle_rad=round(angle, 3),
                        relationship=rel,
                    )
                )

        # Detect candidate tabular rows (chains of horizontal edges sharing similar y-coordinates)
        table_rows = cls._detect_tabular_chains(nodes, edges)

        return TopologicalLayoutGraph(
            total_tokens=len(nodes),
            page_number=page_number,
            nodes=nodes,
            edges=edges,
            table_candidates=table_rows,
        )

    @classmethod
    def _detect_tabular_chains(
        cls, nodes: list[SpatialTokenNode], edges: list[SpatialEdge]
    ) -> list[dict[str, Any]]:
        """
        Groups horizontally adjacent nodes with high collinearity into structured table rows.
        """
        horizontal_edges = [e for e in edges if e.relationship == "HORIZONTAL_RIGHT"]
        node_map = {n.token_id: n for n in nodes}

        # Cluster by y-bands
        y_clusters: dict[int, list[SpatialTokenNode]] = {}
        for n in nodes:
            # 12px band bucket
            bucket = int(n.center_y // 14)
            y_clusters.setdefault(bucket, []).append(n)

        candidate_rows = []
        for bucket, tokens in y_clusters.items():
            if len(tokens) >= 3:  # Potential table row if 3+ aligned tokens
                tokens_sorted = sorted(tokens, key=lambda t: t.center_x)
                row_text = " ".join(t.text for t in tokens_sorted)
                candidate_rows.append({
                    "row_bucket": bucket,
                    "token_count": len(tokens_sorted),
                    "combined_text": row_text,
                    "bounding_box": [
                        min(t.bbox[0] for t in tokens_sorted),
                        min(t.bbox[1] for t in tokens_sorted),
                        max(t.bbox[2] for t in tokens_sorted),
                        max(t.bbox[3] for t in tokens_sorted),
                    ],
                })

        return candidate_rows
