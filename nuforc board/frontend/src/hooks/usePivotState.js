import { useCallback, useEffect, useState } from "react";
import { fetchJSON } from "../lib/api";
import {
  buildDashboardSearch,
  DASHBOARD_COLUMNS,
  DEFAULT_DASHBOARD_STATE,
  parseDashboardSearch,
  toPivotQuery,
} from "../lib/dashboardQuery";

function initialFromLocation() {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_STATE;
  return parseDashboardSearch(window.location.search);
}

export function usePivotState() {
  const [state, setState] = useState(initialFromLocation);
  const [pivot, setPivot] = useState({
    slice_total: 0,
    shape_bins: [],
    state_bins: [],
    city_bins: [],
    date_bins: [],
  });

  // Sync URL <-> state
  useEffect(() => {
    const onPopState = () => setState(parseDashboardSearch(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const search = buildDashboardSearch(state);
    const next = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) window.history.replaceState(null, "", next);
  }, [state]);

  // Load pivot histogram data
  useEffect(() => {
    let cancelled = false;
    async function loadPivot() {
      try {
        const payload = await fetchJSON(`/api/pivot?${toPivotQuery(state).toString()}`);
        if (!cancelled) setPivot(payload || {});
      } catch {
        if (!cancelled) setPivot({ slice_total: 0, shape_bins: [], state_bins: [], city_bins: [], date_bins: [] });
      }
    }
    loadPivot();
    return () => { cancelled = true; };
  }, [state.pivot, state.pin]);

  const updatePivot = useCallback((key, value) => {
    setState((cur) => {
      const nextPivot = { ...cur.pivot, [key]: value };
      if (key === "state" && (!value || value !== cur.pivot.state)) nextPivot.city = "";
      return { ...cur, pivot: nextPivot, offset: 0, sampleSetId: "" };
    });
  }, []);

  const updateMode = useCallback((mode) => {
    const valid = ["explore", "compare", "pipeline", "discover"];
    setState((cur) => ({ ...cur, mode: valid.includes(mode) ? mode : "explore", offset: 0 }));
  }, []);

  const togglePin = useCallback((lane) => {
    setState((cur) => {
      const has = cur.pin.includes(lane);
      return { ...cur, pin: has ? cur.pin.filter((v) => v !== lane) : [...cur.pin, lane] };
    });
  }, []);

  const updateSlice = useCallback(() => {
    setState((cur) => ({ ...cur, offset: 0 }));
  }, []);

  const setGroupBy = useCallback((groupBy) => {
    setState((cur) => ({ ...cur, groupBy }));
  }, []);

  const toggleColumn = useCallback((column) => {
    setState((cur) => {
      const exists = cur.columns.includes(column);
      let columns = exists ? cur.columns.filter((v) => v !== column) : [...cur.columns, column];
      if (!columns.length) columns = [...DASHBOARD_COLUMNS];
      return { ...cur, columns };
    });
  }, []);

  const setKeyword = useCallback((keyword) => {
    setState((cur) => ({ ...cur, keyword, offset: 0 }));
  }, []);

  const setSignalFilter = useCallback((signal) => {
    setState((cur) => ({ ...cur, signal: cur.signal === signal ? "" : signal, offset: 0 }));
  }, []);

  const selectCase = useCallback((sightingId) => {
    setState((cur) => ({ ...cur, selectedCaseId: sightingId || null }));
  }, []);

  const prevPage = useCallback(() => {
    setState((cur) => ({ ...cur, offset: Math.max(0, cur.offset - 80) }));
  }, []);

  const nextPage = useCallback(() => {
    setState((cur) => ({ ...cur, offset: cur.offset + 80 }));
  }, []);

  const updateCompare = useCallback((patch) => {
    setState((cur) => ({ ...cur, compare: { ...cur.compare, ...patch } }));
  }, []);

  const patchState = useCallback((patch) => {
    setState((cur) => ({ ...cur, ...patch }));
  }, []);

  return {
    state,
    pivot,
    updatePivot,
    updateMode,
    togglePin,
    updateSlice,
    setGroupBy,
    toggleColumn,
    setKeyword,
    setSignalFilter,
    selectCase,
    prevPage,
    nextPage,
    updateCompare,
    patchState,
  };
}
