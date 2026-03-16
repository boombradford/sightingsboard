import { useRef, useCallback } from "react";
import MapGL, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGeoJSON } from "../../hooks/useGeoJSON";
import {
  darkStyle,
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from "../../lib/mapStyles";

export default function MapView({ items = [], onSelectCase }) {
  const mapRef = useRef(null);
  const geojson = useGeoJSON(items);

  const onClick = useCallback(
    (e) => {
      const map = mapRef.current?.getMap?.();
      if (!map) return;

      // Check clusters first
      const clusterFeatures = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      if (clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties.cluster_id;
        const source = map.getSource("sightings");
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: clusterFeatures[0].geometry.coordinates,
            zoom,
            duration: 500,
          });
        });
        return;
      }

      // Check individual points
      const pointFeatures = map.queryRenderedFeatures(e.point, {
        layers: ["unclustered-point"],
      });
      if (pointFeatures.length > 0 && onSelectCase) {
        onSelectCase(pointFeatures[0].properties.id);
      }
    },
    [onSelectCase]
  );

  const onMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (map) map.getCanvas().style.cursor = "pointer";
  }, []);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  if (geojson.features.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-caption text-zinc-500">
        No geocoded sightings to display on map.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800" style={{ height: 420 }}>
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: -98.5,
          latitude: 39.8,
          zoom: 3.5,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={darkStyle}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        interactiveLayerIds={["clusters", "unclustered-point"]}
      >
        <Source
          id="sightings"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
      </MapGL>
    </div>
  );
}
