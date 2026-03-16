import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJSON } from "../lib/api";
import { toSightingQuery } from "../lib/dashboardQuery";
import { describeError } from "../lib/format";

function topSignalsFromItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const counts = new Map();
  for (const item of items) {
    for (const signal of (Array.isArray(item.signals) ? item.signals : [])) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  const total = items.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count, pct: Number(((count / total) * 100).toFixed(1)) }));
}

function groupItems(items, groupBy) {
  if (!Array.isArray(items) || !items.length) return [];
  const keyFor = (item) => {
    if (groupBy === "shape") return item.shape || "unknown";
    if (groupBy === "state") return item.state || "--";
    if (groupBy === "decade") {
      const year = String(item.date_time || "").slice(0, 4);
      return /^\d{4}$/.test(year) ? `${Math.floor(Number(year) / 10) * 10}s` : "unknown";
    }
    if (groupBy === "explainable") return item.explainable ? "Potentially explainable" : "Unexplained";
    return "All cases";
  };
  const map = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.entries()].map(([key, values]) => ({ key, items: values }));
}

export function useSightings(state) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, returned: 0, slice_signals: [], updated_at: null });
  const [loadingMain, setLoadingMain] = useState(false);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;

    async function loadMain() {
      setLoadingMain(true);
      try {
        if (state.sampleSetId) {
          const payload = await fetchJSON(`/api/sample-sets/${state.sampleSetId}`);
          if (cancelled || seq !== requestSeq.current) return;
          const sampleItems = Array.isArray(payload.items) ? payload.items : [];
          const filtered = state.signal
            ? sampleItems.filter((item) => Array.isArray(item.signals) && item.signals.includes(state.signal))
            : sampleItems;
          setItems(filtered);
          setMeta({
            total: sampleItems.length,
            returned: filtered.length,
            offset: 0,
            slice_signals: topSignalsFromItems(filtered),
            updated_at: payload.updated_at || new Date().toISOString(),
          });
          setError("");
          return;
        }

        if (state.mode === "compare") {
          setItems([]);
          setMeta((cur) => ({ ...cur, returned: 0 }));
          setError("");
          return;
        }

        const payload = await fetchJSON(`/api/sightings?${toSightingQuery(state, 80).toString()}`);
        if (cancelled || seq !== requestSeq.current) return;

        const incoming = Array.isArray(payload.items) ? payload.items : [];
        const filtered = state.signal
          ? incoming.filter((item) => Array.isArray(item.signals) && item.signals.includes(state.signal))
          : incoming;

        setItems(filtered);
        setMeta({
          total: Number(payload?.meta?.total || 0),
          returned: filtered.length,
          offset: Number(payload?.meta?.offset || 0),
          slice_signals: Array.isArray(payload?.meta?.slice_signals) ? payload.meta.slice_signals : topSignalsFromItems(filtered),
          updated_at: payload?.meta?.updated_at || new Date().toISOString(),
        });
        setError("");
      } catch (err) {
        if (!cancelled && seq === requestSeq.current) {
          setError(`Could not load sightings: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoadingMain(false);
      }
    }

    loadMain();
    return () => { cancelled = true; };
  }, [state.mode, state.pivot, state.offset, state.signal, state.order, state.keyword, state.sampleSetId, state.compare]);


  const patchItem = useCallback((sightingId, patch) => {
    setItems((cur) => cur.map((item) => item.sighting_id === sightingId ? { ...item, ...patch } : item));
  }, []);

  const groupedItems = useMemo(() => groupItems(items, state.groupBy), [items, state.groupBy]);

  return { items, meta, groupedItems, loadingMain, error, patchItem };
}
