import type { StylesheetJsonBlock } from "cytoscape";

export const cytoscapeStyles: StylesheetJsonBlock[] = [
  {
    selector: "node",
    style: {
      "background-color": "#0e72c9",
      "border-color": "#61b9ff",
      "border-width": 1,
      color: "#eaf6ff",
      "font-family": "Inter, system-ui, sans-serif",
      "font-size": "15px",
      "font-weight": 700,
      height: 54,
      label: "data(displayLabel)",
      "overlay-opacity": 0,
      shape: "ellipse",
      "text-halign": "center",
      "text-max-width": "42px",
      "text-valign": "center",
      "text-wrap": "none",
      width: 54
    }
  },
  {
    selector: "node[lifeStatus = 'deceased']",
    style: {
      "background-color": "#29445f",
      "border-color": "#7d93aa"
    }
  },
  {
    selector: "node[photoUrl]",
    style: {
      "background-fit": "cover",
      "background-image": "data(photoUrl)",
      "background-opacity": 1
    }
  },
  {
    selector: "node.matched",
    style: {
      "background-color": "#1194ff",
      "border-color": "#fff0a6",
      "border-width": 1
    }
  },
  {
    selector: "node.search-muted",
    style: {
      "background-color": "#14202c",
      "border-color": "#31485c",
      color: "#5f7488",
      opacity: 0.16
    }
  },
  {
    selector: "node.selected",
    style: {
      "background-color": "#d7f2ff",
      "border-color": "#ffffff",
      color: "#04111f",
      "border-width": 1,
      opacity: 1
    }
  },
  {
    selector: "node.hovered",
    style: {
      "border-color": "#ffffff",
      "border-width": 2
    }
  },
  {
    selector: "node.dimmed",
    style: {
      opacity: 0.28
    }
  },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier",
      "line-color": "#225f98",
      "target-arrow-color": "#225f98",
      "target-arrow-shape": "triangle",
      "target-arrow-fill": "filled",
      label: "data(label)",
      color: "#8ecfff",
      "font-family": "Inter, system-ui, sans-serif",
      "font-size": "9px",
      "line-style": "solid",
      opacity: 0.78,
      "text-background-color": "#06111e",
      "text-background-opacity": 0.82,
      "text-background-padding": "3px",
      width: 2
    }
  },
  {
    selector: "edge[direction = 'symmetric']",
    style: {
      "target-arrow-shape": "none"
    }
  },
  {
    selector: "edge.dimmed",
    style: {
      opacity: 0.18
    }
  },
  {
    selector: "edge.search-muted",
    style: {
      opacity: 0.08
    }
  }
];
