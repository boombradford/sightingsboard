import { useMemo } from "react";

/**
 * Converts an array of sighting items into a GeoJSON FeatureCollection
 * for use with react-map-gl clustering.
 */
export function useGeoJSON(items) {
  return useMemo(() => {
    const features = [];
    for (const item of items) {
      const lat = parseFloat(item.latitude);
      const lng = parseFloat(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: item.sighting_id,
          shape: item.shape,
          score: item.story_score ?? 0,
          city: item.city,
          state: item.state,
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [items]);
}
