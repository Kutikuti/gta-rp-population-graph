import type cytoscape from "cytoscape";

import type { PublicGraph } from "../api";

export type GraphLayoutMode = "grouped" | "company" | "network";

const normalizedClusterName = (value: string | null, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

type Position = { x: number; y: number };

const clusteredPositions = (
  graph: PublicGraph,
  width: number,
  height: number,
  clusterKey: "groupName" | "companyName",
  emptyLabel: string
): Record<string, Position> => {
  const groupedNodes = new Map<string, PublicGraph["nodes"]>();

  for (const node of graph.nodes) {
    const key = normalizedClusterName(node.data[clusterKey], emptyLabel);
    const entries = groupedNodes.get(key);

    if (entries) {
      entries.push(node);
    } else {
      groupedNodes.set(key, [node]);
    }
  }

  const groups = [...groupedNodes.entries()].sort(([left], [right]) =>
    left.localeCompare(right, "fr")
  );
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(groups.length || 1)));
  const rowCount = Math.max(1, Math.ceil(groups.length / columnCount));
  const cellWidth = Math.max(260, width / columnCount);
  const cellHeight = Math.max(220, height / rowCount);
  const positions: Record<string, Position> = {};

  groups.forEach(([_groupName, nodes], groupIndex) => {
    const columnIndex = groupIndex % columnCount;
    const rowIndex = Math.floor(groupIndex / columnCount);
    const centerX = columnIndex * cellWidth + cellWidth / 2;
    const centerY = rowIndex * cellHeight + cellHeight / 2;
    const sortedNodes = [...nodes].sort((left, right) =>
      left.data.fullName.localeCompare(right.data.fullName, "fr")
    );
    const localColumnCount = Math.max(1, Math.ceil(Math.sqrt(sortedNodes.length || 1)));
    const localRowCount = Math.max(1, Math.ceil(sortedNodes.length / localColumnCount));
    const horizontalGap = Math.min(108, cellWidth / Math.max(2, localColumnCount + 0.5));
    const verticalGap = Math.min(104, cellHeight / Math.max(2, localRowCount + 0.5));

    sortedNodes.forEach((node, nodeIndex) => {
      const localColumnIndex = nodeIndex % localColumnCount;
      const localRowIndex = Math.floor(nodeIndex / localColumnCount);
      const offsetX = (localColumnIndex - (localColumnCount - 1) / 2) * horizontalGap;
      const offsetY = (localRowIndex - (localRowCount - 1) / 2) * verticalGap;

      positions[node.data.id] = {
        x: centerX + offsetX,
        y: centerY + offsetY
      };
    });
  });

  return positions;
};

export const graphLayoutOptions = (
  graph: PublicGraph,
  mode: GraphLayoutMode,
  containerSize: { width: number; height: number }
): cytoscape.LayoutOptions => {
  if (mode === "grouped") {
    const positions = clusteredPositions(
      graph,
      containerSize.width,
      containerSize.height,
      "groupName",
      "Sans groupe"
    );

    return {
      name: "preset",
      fit: true,
      padding: 48,
      animate: false,
      positions: (nodeId: string) =>
        positions[nodeId] ?? { x: containerSize.width / 2, y: containerSize.height / 2 }
    };
  }

  if (mode === "company") {
    const positions = clusteredPositions(
      graph,
      containerSize.width,
      containerSize.height,
      "companyName",
      "Sans entreprise"
    );

    return {
      name: "preset",
      fit: true,
      padding: 48,
      animate: false,
      positions: (nodeId: string) =>
        positions[nodeId] ?? { x: containerSize.width / 2, y: containerSize.height / 2 }
    };
  }

  return {
    name: "cose",
    animate: false,
    fit: true,
    padding: 48,
    nodeRepulsion: 6800,
    idealEdgeLength: 150
  };
};
