import { useEffect, useMemo, useState } from "react";
import { fetchJSON } from "../lib/api";
import { describeError } from "../lib/format";

export function usePulseStats(meta) {
  const [options, setOptions] = useState({ states: [], shapes: [] });
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadStatic() {
      setLoadingStats(true);
      try {
        const [opt, st] = await Promise.all([fetchJSON("/api/options"), fetchJSON("/api/stats")]);
        if (cancelled) return;
        setOptions({
          states: Array.isArray(opt.states) ? opt.states : [],
          shapes: Array.isArray(opt.shapes) ? opt.shapes : [],
        });
        setStats(st || null);
      } catch (err) {
        if (!cancelled) setStatsError(`Could not load dashboard options/stats: ${describeError(err)}`);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }
    loadStatic();
    return () => { cancelled = true; };
  }, []);

  const pulse = useMemo(() => {
    const total = Number(stats?.total_sightings || 0);
    const geocoded = Number(stats?.geocoded_sightings || 0);
    const geocodedPct = total ? ((geocoded / total) * 100).toFixed(1) : "0.0";
    return {
      total,
      slice: Number(meta?.returned || 0),
      geocodedPct,
      updatedAt: meta?.updated_at,
    };
  }, [meta, stats]);

  return { options, stats, loadingStats, statsError, pulse };
}
