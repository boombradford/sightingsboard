import { lazy, Suspense, useMemo, useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";

const MapInner = lazy(() => import("./SightingsHeatmapInner"));

export default function SightingsHeatmap({ sightings = [], height = 400, onLocationClick }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-xl border border-white/[0.06] bg-surface-card" style={{ height }}>
          <p className="text-caption text-slate-500">Loading map...</p>
        </div>
      }
    >
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={springs.gentle}
      >
        <MapInner sightings={sightings} height={height} onLocationClick={onLocationClick} />
      </m.div>
    </Suspense>
  );
}
