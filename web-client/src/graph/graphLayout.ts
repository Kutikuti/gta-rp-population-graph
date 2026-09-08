import type cytoscape from "cytoscape";

import type { PublicGraph } from "../api";

export type GraphLayoutMode = "grouped" | "company" | "family" | "network";
const familyRelationshipTypes = new Set(["parent", "child", "sibling"]);
const emptyClusterValueAliases = new Set([
  "aucun groupe",
  "aucun metier/entreprise",
  "non renseigne",
  "sans entreprise",
  "sans groupe"
]);
const compactNeutralNodeGap = 68;

const normalizedClusterName = (value: string | null, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const normalized = trimmed
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");

  return emptyClusterValueAliases.has(normalized) ? fallback : trimmed;
};

type Position = { x: number; y: number };

type ClusterGroup = {
  key: string;
  nodes: PublicGraph["nodes"];
  nodeGap?: number;
};

const positionsFromGroups = (
  groups: ClusterGroup[],
  width: number,
  height: number
): Record<string, Position> => {
  const sortedGroups = [...groups].sort((left, right) => left.key.localeCompare(right.key, "fr"));
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(sortedGroups.length || 1)));
  const rowCount = Math.max(1, Math.ceil(sortedGroups.length / columnCount));
  const positions: Record<string, Position> = {};
  const circles = sortedGroups.map((group) => {
    const nodeGap = group.nodeGap ?? 120;
    const nodes = [...group.nodes].sort(
      (left, right) =>
        left.data.fullName.localeCompare(right.data.fullName, "fr") ||
        left.data.id.localeCompare(right.data.id)
    );
    const offsets: Position[] = [];
    let radius = 0;
    if (nodes.length === 1) offsets.push({ x: 0, y: 0 });
    while (offsets.length < nodes.length) {
      radius += nodeGap;
      const capacity = Math.floor(Math.PI / Math.asin(nodeGap / (2 * radius)));
      const count = Math.min(capacity, nodes.length - offsets.length);
      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
        offsets.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      }
    }
    return { nodes, offsets, diameter: radius * 2 + 200 };
  });
  const columnWidths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(
      width / columnCount,
      260,
      ...circles.filter((_, i) => i % columnCount === column).map((circle) => circle.diameter)
    )
  );
  const rowHeights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(
      height / rowCount,
      260,
      ...circles.slice(row * columnCount, (row + 1) * columnCount).map((circle) => circle.diameter)
    )
  );

  circles.forEach((group, groupIndex) => {
    const columnIndex = groupIndex % columnCount;
    const rowIndex = Math.floor(groupIndex / columnCount);
    const centerX =
      columnWidths.slice(0, columnIndex).reduce((sum, size) => sum + size, 0) +
      (columnWidths[columnIndex] ?? 260) / 2;
    const centerY =
      rowHeights.slice(0, rowIndex).reduce((sum, size) => sum + size, 0) +
      (rowHeights[rowIndex] ?? 260) / 2;

    group.nodes.forEach((node, nodeIndex) => {
      const offset = group.offsets[nodeIndex] ?? { x: 0, y: 0 };

      positions[node.data.id] = {
        x: centerX + offset.x,
        y: centerY + offset.y
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

  const groups = [...groupedNodes.entries()].map(([key, nodes]) => ({
    key,
    nodes,
    ...(key === emptyLabel ? { nodeGap: compactNeutralNodeGap } : {})
  }));

  return positionsFromGroups(groups, width, height);
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
