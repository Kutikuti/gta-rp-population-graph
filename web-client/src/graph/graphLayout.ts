import type cytoscape from "cytoscape";

import type { PublicGraph } from "../api";

export type GraphLayoutMode = "grouped" | "company" | "family" | "network";
const familyRelationshipTypes = new Set(["parent", "child", "sibling"]);

const normalizedClusterName = (value: string | null, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

type Position = { x: number; y: number };

type ClusterGroup = {
  key: string;
  nodes: PublicGraph["nodes"];
};

const positionsFromGroups = (
  groups: ClusterGroup[],
  width: number,
  height: number
): Record<string, Position> => {
  const sortedGroups = [...groups].sort((left, right) => left.key.localeCompare(right.key, "fr"));
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(sortedGroups.length || 1)));
  const rowCount = Math.max(1, Math.ceil(sortedGroups.length / columnCount));
  const cellWidth = Math.max(260, width / columnCount);
  const cellHeight = Math.max(220, height / rowCount);
  const positions: Record<string, Position> = {};

  sortedGroups.forEach((group, groupIndex) => {
    const columnIndex = groupIndex % columnCount;
    const rowIndex = Math.floor(groupIndex / columnCount);
    const centerX = columnIndex * cellWidth + cellWidth / 2;
    const centerY = rowIndex * cellHeight + cellHeight / 2;
    const sortedNodes = [...group.nodes].sort((left, right) =>
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

  return positionsFromGroups(
    [...groupedNodes.entries()].map(([key, nodes]) => ({ key, nodes })),
    width,
    height
  );
};

const familyClusteredPositions = (
  graph: PublicGraph,
  width: number,
  height: number
): Record<string, Position> => {
  const nodesById = new Map(graph.nodes.map((node) => [node.data.id, node] as const));
  const adjacency = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    adjacency.set(node.data.id, new Set());
  }

  for (const edge of graph.edges) {
    if (!familyRelationshipTypes.has(edge.data.relationshipType)) {
      continue;
    }

    const source = edge.data.source;
    const target = edge.data.target;

    if (!nodesById.has(source) || !nodesById.has(target)) {
      continue;
    }

    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  }

  const visited = new Set<string>();
  const groups: ClusterGroup[] = [];

  for (const node of graph.nodes) {
    if (visited.has(node.data.id)) {
      continue;
    }

    const stack = [node.data.id];
    const componentNodes: PublicGraph["nodes"] = [];

    while (stack.length > 0) {
      const currentId = stack.pop();

      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      const currentNode = nodesById.get(currentId);

      if (currentNode) {
        componentNodes.push(currentNode);
      }

      for (const neighborId of adjacency.get(currentId) ?? []) {
        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      }
    }

    const key =
      componentNodes
        .map((entry) => entry.data.fullName)
        .sort((left, right) => left.localeCompare(right, "fr"))[0] ?? node.data.fullName;

    groups.push({ key, nodes: componentNodes });
  }

  return positionsFromGroups(groups, width, height);
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
      positions
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
      positions
    };
  }

  if (mode === "family") {
    return {
      name: "preset",
      fit: true,
      padding: 48,
      animate: false,
      positions: familyClusteredPositions(graph, containerSize.width, containerSize.height)
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
