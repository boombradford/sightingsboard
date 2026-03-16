import { useCallback, useEffect, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { fadeUp, springs, stagger, cardVariants } from "../../lib/motion";
import { fetchJSON, postJSON, deleteJSON } from "../../lib/api";
import ShapeIcon from "../shared/ShapeIcon";
import ScoreGauge from "../casefile/ScoreGauge";
import EmptyState from "../shared/EmptyState";
import { useClusters } from "../../hooks/useClusters";

const THEMES = [
  { id: null, label: "All" },
  { id: "triangle", label: "Triangle" },
  { id: "military", label: "Military" },
  { id: "abduction", label: "Abduction" },
  { id: "lights", label: "Lights" },
  { id: "landing", label: "Landing" },
  { id: "formation", label: "Formation" },
  { id: "pilot", label: "Pilot" },
  { id: "radar", label: "Radar" },
];

const CLUSTER_PRESETS = [
  { label: "Tight (7d / 30km)", time_window_days: 7, radius_km: 30 },
  { label: "Default (30d / 80km)", time_window_days: 30, radius_km: 80 },
  { label: "Wide (90d / 150km)", time_window_days: 90, radius_km: 150 },
];

function ClusterCard({ cluster, index, onSelectCase }) {
  const dateRange = cluster.date_range || {};
  const earliest = (dateRange.earliest || "").slice(0, 10);
  const latest = (dateRange.latest || "").slice(0, 10);
  const dateLabel = earliest === latest ? earliest : `${earliest} — ${latest}`;
  const topShape = cluster.dominant_shapes?.[0];
  const topLocation = cluster.dominant_locations?.[0];
  const hasSample = cluster.sample_ids?.length > 0;

  const lat = cluster.centroid?.lat;
  const lon = cluster.centroid?.lon;
  const latLabel = lat != null ? `${Math.abs(lat).toFixed(2)}${lat >= 0 ? "N" : "S"}` : "—";
  const lonLabel = lon != null ? `${Math.abs(lon).toFixed(2)}${lon >= 0 ? "E" : "W"}` : "—";

  return (
    <m.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className={`group flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] ${hasSample ? "cursor-pointer" : ""}`}
      onClick={() => hasSample && onSelectCase(cluster.sample_ids[0])}
    >
      {/* Header: count badge + shape */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-micro font-bold text-emerald-400">
            {cluster.count}
          </span>
          <span className="text-caption font-medium text-zinc-200">sightings</span>
        </div>
        {topShape && (
          <div className="flex items-center gap-1.5">
            <ShapeIcon shape={topShape.shape} size={16} className="text-zinc-400" />
            <span className="text-micro capitalize text-zinc-400">{topShape.shape}</span>
          </div>
        )}
      </div>

      {/* Date range */}
      <p className="mb-1.5 font-mono text-micro text-zinc-500">{dateLabel || "Unknown dates"}</p>

      {/* Location */}
      {topLocation && (
        <p className="mb-2 text-caption text-zinc-300">{topLocation.location}</p>
      )}

      {/* Shape breakdown chips */}
      <div className="mt-auto flex flex-wrap gap-1">
        {cluster.dominant_shapes?.map(({ shape, count }) => (
          <span
            key={shape}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 px-2 py-0.5 text-micro text-zinc-400"
          >
            <ShapeIcon shape={shape} size={11} className="text-zinc-500" />
            {shape} ({count})
          </span>
        ))}
      </div>

      {/* Centroid coordinates */}
      <p className="mt-2 font-mono text-[10px] text-zinc-600">
        {latLabel}, {lonLabel}
      </p>
    </m.div>
  );
}

export default function DiscoverView({ onSelectCase, onToggleBookmark }) {
  const [items, setItems] = useState([]);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [clusterPreset, setClusterPreset] = useState(1);
  const [showClusters, setShowClusters] = useState(false);

  const preset = CLUSTER_PRESETS[clusterPreset];
  const { clusters, meta: clusterMeta, loading: clustersLoading } = useClusters(
    showClusters ? { ...preset, min_cluster_size: 3, limit: 12 } : null
  );

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    try {
      const url = theme
        ? `/api/discover?limit=24&theme=${encodeURIComponent(theme)}`
        : "/api/discover?limit=24";
      const payload = await fetchJSON(url);
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [theme, shuffleKey]);

  useEffect(() => {
    loadDiscover();
  }, [loadDiscover]);

  const handleDismiss = useCallback(async (sightingId) => {
    // Optimistically remove from local state
    setItems((cur) => cur.filter((item) => item.sighting_id !== sightingId));
    try {
      await postJSON("/api/discover/dismiss", { sighting_id: sightingId });
    } catch {
      // Silently fail — item is already gone from view, next shuffle will exclude it
    }
  }, []);

  const handleToggleBookmark = useCallback(async (sightingId, isBookmarked) => {
    // Optimistic update
    setItems((cur) => cur.map((item) =>
      item.sighting_id === sightingId ? { ...item, is_bookmarked: !isBookmarked } : item
    ));
    try {
      await onToggleBookmark(sightingId, isBookmarked);
    } catch {
      // Revert on error
      setItems((cur) => cur.map((item) =>
        item.sighting_id === sightingId ? { ...item, is_bookmarked: isBookmarked } : item
      ));
    }
  }, [onToggleBookmark]);

  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-zinc-100">Discover Stories</h2>
        <m.button
          type="button"
          onClick={() => setShuffleKey((k) => k + 1)}
          whileTap={{ scale: 0.97, transition: springs.snappy }}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-micro font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          Shuffle
        </m.button>
      </div>

      {/* Theme chips */}
      <div className="flex flex-wrap gap-1.5">
        {THEMES.map((t) => (
          <button
            key={t.id ?? "all"}
            type="button"
            onClick={() => setTheme(t.id)}
            className={`rounded-full border px-3 py-1 text-micro font-medium transition-colors ${
              theme === t.id
                ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-zinc-800/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No stories found"
          description={theme ? `No matching stories for "${theme}". Try another theme or shuffle.` : "Run --backfill-scores first to populate story scores."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.sighting_id}
              className={`group flex flex-col rounded-lg border p-4 transition-all cursor-pointer ${
                item.story_score >= 70
                  ? "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-zinc-900/50 hover:border-amber-500/35 hover:shadow-[0_0_24px_rgba(245,158,11,0.06)]"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              }`}
              onClick={() => onSelectCase(item.sighting_id)}
            >
              {/* Top row: score + shape */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShapeIcon shape={item.shape} size={18} className="text-zinc-400" />
                  <span className="text-caption font-medium capitalize text-zinc-200">{item.shape}</span>
                </div>
                <ScoreGauge score={item.story_score} size={36} />
              </div>

              {/* Location + date */}
              <p className="mb-2 font-mono text-micro text-zinc-500">
                {item.city}, {item.state} — {item.date_time}
              </p>

              {/* Snippet */}
              <p className="mb-3 flex-1 text-caption leading-relaxed text-zinc-300 line-clamp-4">
                {item.report_text
                  ? item.report_text.slice(0, 280) + (item.report_text.length > 280 ? "..." : "")
                  : item.summary || "No description available."}
              </p>

              {/* AI summary if available */}
              {item.ai_brief?.summary?.synopsis_bullets?.[0] && (
                <p className="mb-3 rounded border border-blue-500/10 bg-blue-500/[0.03] px-2 py-1 text-micro text-blue-300 line-clamp-2">
                  {item.ai_brief.summary.synopsis_bullets[0]}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleBookmark(item.sighting_id, item.is_bookmarked);
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-micro font-medium transition-colors ${
                    item.is_bookmarked
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={item.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {item.is_bookmarked ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(item.sighting_id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1.5 text-micro font-medium text-zinc-500 hover:border-red-500/30 hover:text-red-400 transition-colors ml-auto"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="hidden sm:inline">Not interested</span>
                  <span className="sm:hidden">Skip</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Event Clusters ── */}
      <div className="mt-6 border-t border-zinc-800 pt-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowClusters((v) => !v)}
            className="flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-400">
              <circle cx="12" cy="12" r="3" />
              <circle cx="5" cy="7" r="2" />
              <circle cx="19" cy="7" r="2" />
              <circle cx="5" cy="17" r="2" />
              <circle cx="19" cy="17" r="2" />
              <line x1="9.5" y1="10.5" x2="6.5" y2="8.5" />
              <line x1="14.5" y1="10.5" x2="17.5" y2="8.5" />
              <line x1="9.5" y1="13.5" x2="6.5" y2="15.5" />
              <line x1="14.5" y1="13.5" x2="17.5" y2="15.5" />
            </svg>
            <h3 className="font-display text-base font-semibold text-zinc-100">Event Clusters</h3>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`text-zinc-500 transition-transform ${showClusters ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showClusters && clusterMeta.total_geocoded > 0 && (
            <span className="text-micro text-zinc-500">
              {clusterMeta.total_geocoded.toLocaleString()} geocoded sightings
            </span>
          )}
        </div>

        <AnimatePresence>
          {showClusters && (
            <m.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-3 space-y-3"
            >
              {/* Preset chips */}
              <div className="flex flex-wrap gap-1.5">
                {CLUSTER_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setClusterPreset(i)}
                    className={`rounded-full border px-3 py-1 text-micro font-medium transition-colors ${
                      clusterPreset === i
                        ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Cluster grid */}
              {clustersLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-36 animate-pulse rounded-lg bg-zinc-800/50" />
                  ))}
                </div>
              ) : clusters.length === 0 ? (
                <p className="py-6 text-center text-caption text-zinc-500">
                  No clusters found with current parameters. Try a wider window or radius.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {clusters.map((cluster, i) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      index={i}
                      onSelectCase={onSelectCase}
                    />
                  ))}
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.div>
  );
}
