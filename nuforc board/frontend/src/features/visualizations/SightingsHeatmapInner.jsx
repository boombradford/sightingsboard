import { useState } from "react";
import { Map, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const heatmapLayer = {
  id: "sightings-heat",
  type: "heatmap",
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, 10, 1],
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 9, 3],
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(10, 17, 32, 0)",
      0.2, "rgba(94, 234, 212, 0.15)",
      0.4, "rgba(94, 234, 212, 0.35)",
      0.6, "rgba(45, 212, 191, 0.5)",
      0.8, "rgba(251, 191, 36, 0.65)",
      1, "rgba(251, 113, 133, 0.8)",
    ],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 9, 30],
    "heatmap-opacity": 0.8,
  },
};

export default function SightingsHeatmapInner({ sightings = [], height = 400 }) {
  const [viewState, setViewState] = useState({
    longitude: -98.5,
    latitude: 39.8,
    zoom: 3.5,
  });

  const geojson = {
    type: "FeatureCollection",
    features: sightings
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(s.longitude), Number(s.latitude)] },
        properties: { id: s.sighting_id, count: 1, shape: s.shape || "unknown" },
      })),
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
      <Map
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        style={{ width: "100%", height }}
        mapStyle={DARK_STYLE}
        attributionControl={false}
      >
        <Source id="sightings" type="geojson" data={geojson}>
          <Layer {...heatmapLayer} />
        </Source>
      </Map>
    </div>
  );
}
