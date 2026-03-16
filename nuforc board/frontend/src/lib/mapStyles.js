// Dark base style for MapLibre GL — no API key needed
export const darkStyle = {
  version: 8,
  name: "Sky Ledger Dark",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap",
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.85,
        "raster-brightness-max": 0.35,
        "raster-contrast": 0.1,
      },
    },
  ],
};

// Cluster paint configs
export const clusterLayer = {
  id: "clusters",
  type: "circle",
  source: "sightings",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "rgba(245, 158, 11, 0.6)",
      20,
      "rgba(245, 158, 11, 0.75)",
      100,
      "rgba(245, 158, 11, 0.9)",
    ],
    "circle-radius": ["step", ["get", "point_count"], 16, 20, 22, 100, 30],
    "circle-stroke-width": 1,
    "circle-stroke-color": "rgba(245, 158, 11, 0.3)",
  },
};

export const clusterCountLayer = {
  id: "cluster-count",
  type: "symbol",
  source: "sightings",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["Open Sans Bold"],
    "text-size": 11,
  },
  paint: {
    "text-color": "#09090b",
  },
};

export const unclusteredPointLayer = {
  id: "unclustered-point",
  type: "circle",
  source: "sightings",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": "rgba(245, 158, 11, 0.7)",
    "circle-radius": 5,
    "circle-stroke-width": 1,
    "circle-stroke-color": "rgba(245, 158, 11, 0.3)",
  },
};
