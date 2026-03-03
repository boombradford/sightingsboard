import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJSON, patchJSON, postJSON } from "../lib/api";
import { describeError } from "../lib/format";
import {
  buildCaseFromItems,
  buildDashboardSearch,
  DASHBOARD_COLUMNS,
  DEFAULT_DASHBOARD_STATE,
  parseDashboardSearch,
  toComparePayload,
  toPivotQuery,
  toSamplePayload,
  toSightingQuery,
} from "../lib/dashboardQuery";

function initialFromLocation() {
  if (typeof window === "undefined") {
    return DEFAULT_DASHBOARD_STATE;
  }
  return parseDashboardSearch(window.location.search);
}

function groupItems(items, groupBy) {
  const groups = [];
  if (!Array.isArray(items) || !items.length) return groups;

  const keyFor = (item) => {
    if (groupBy === "shape") return item.shape || "unknown";
    if (groupBy === "state") return item.state || "--";
    if (groupBy === "decade") {
      const year = String(item.date_time || "").slice(0, 4);
      if (/^\d{4}$/.test(year)) {
        return `${Math.floor(Number(year) / 10) * 10}s`;
      }
      return "unknown";
    }
    if (groupBy === "explainable") {
      return item.explainable ? "Potentially explainable" : "Unexplained";
    }
    return "All cases";
  };

  const map = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }

  for (const [key, values] of map.entries()) {
    groups.push({ key, items: values });
  }
  return groups;
}

export function useDashboardState() {
  const [state, setState] = useState(initialFromLocation);
  const [options, setOptions] = useState({ states: [], shapes: [] });
  const [stats, setStats] = useState(null);
  const [pivot, setPivot] = useState({
    slice_total: 0,
    shape_bins: [],
    state_bins: [],
    city_bins: [],
    date_bins: [],
  });
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, returned: 0, slice_signals: [], updated_at: null });
  const [compareResult, setCompareResult] = useState({ cohorts: [], baseline: null });
  const [selectedCase, setSelectedCase] = useState(null);
  const [briefVersions, setBriefVersions] = useState([]);
  const [briefDiff, setBriefDiff] = useState(null);
  const [sampleResult, setSampleResult] = useState(null);
  const [sampleSets, setSampleSets] = useState([]);
  const [samplingOpen, setSamplingOpen] = useState(false);
  const [samplingConfig, setSamplingConfig] = useState({
    size: 10,
    strategy: "uniform",
    stratifyBy: "shape",
    hasCoordinates: false,
    hasSources: false,
    hasMedia: false,
  });

  const [loadingMain, setLoadingMain] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCase, setLoadingCase] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState("");

  const requestSeq = useRef(0);

  useEffect(() => {
    const onPopState = () => {
      setState(parseDashboardSearch(window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const search = buildDashboardSearch(state);
    const next = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }, [state]);

  const refreshSampleSets = useCallback(async () => {
    try {
      const payload = await fetchJSON("/api/sample-sets?limit=12");
      setSampleSets(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setSampleSets([]);
    }
  }, []);

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
        if (!cancelled) {
          setError(`Could not load dashboard options/stats: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }
    loadStatic();
    refreshSampleSets();
    return () => {
      cancelled = true;
    };
  }, [refreshSampleSets]);

  useEffect(() => {
    let cancelled = false;
    async function loadPivot() {
      try {
        const payload = await fetchJSON(`/api/pivot?${toPivotQuery(state).toString()}`);
        if (cancelled) return;
        setPivot(payload || {});
      } catch {
        if (!cancelled) {
          setPivot({ slice_total: 0, shape_bins: [], state_bins: [], city_bins: [], date_bins: [] });
        }
      }
    }
    loadPivot();
    return () => {
      cancelled = true;
    };
  }, [state.pivot, state.pin]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;

    async function loadMain() {
      setLoadingMain(true);
      try {
        if (state.sampleSetId) {
          const sampleSetPayload = await fetchJSON(`/api/sample-sets/${state.sampleSetId}`);
          if (cancelled || seq !== requestSeq.current) return;
          const sampleItems = Array.isArray(sampleSetPayload.items) ? sampleSetPayload.items : [];
          const filtered = state.signal
            ? sampleItems.filter((item) => Array.isArray(item.signals) && item.signals.includes(state.signal))
            : sampleItems;
          setItems(filtered);
          setMeta({
            total: sampleItems.length,
            returned: filtered.length,
            offset: 0,
            slice_signals: topSignalsFromItems(filtered),
            updated_at: sampleSetPayload.updated_at || new Date().toISOString(),
          });
          setError("");
          return;
        }

        if (state.mode === "compare") {
          setItems([]);
          setMeta((current) => ({ ...current, returned: 0 }));
          setError("");
          return;
        }

        const payload = await fetchJSON(`/api/sightings?${toSightingQuery(state, 80).toString()}`);
        if (cancelled || seq !== requestSeq.current) return;

        const incomingItems = Array.isArray(payload.items) ? payload.items : [];
        const filtered = state.signal
          ? incomingItems.filter((item) => Array.isArray(item.signals) && item.signals.includes(state.signal))
          : incomingItems;

        setItems(filtered);
        setMeta({
          total: Number(payload?.meta?.total || 0),
          returned: filtered.length,
          offset: Number(payload?.meta?.offset || 0),
          slice_signals: Array.isArray(payload?.meta?.slice_signals)
            ? payload.meta.slice_signals
            : topSignalsFromItems(filtered),
          updated_at: payload?.meta?.updated_at || new Date().toISOString(),
        });
        setError("");
      } catch (err) {
        if (!cancelled && seq === requestSeq.current) {
          setError(`Could not load sightings: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled && seq === requestSeq.current) {
          setLoadingMain(false);
        }
      }
    }

    loadMain();

    return () => {
      cancelled = true;
    };
  }, [
    state.mode,
    state.pivot,
    state.offset,
    state.signal,
    state.sampleSetId,
    state.compare,
  ]);

  useEffect(() => {
    const nextCaseId = buildCaseFromItems(items, state.selectedCaseId);
    if (nextCaseId !== state.selectedCaseId) {
      setState((current) => ({ ...current, selectedCaseId: nextCaseId }));
    }
  }, [items, state.selectedCaseId]);

  useEffect(() => {
    let cancelled = false;
    if (!state.selectedCaseId || state.mode === "compare") {
      setSelectedCase(null);
      setBriefVersions([]);
      return;
    }

    async function loadCase() {
      setLoadingCase(true);
      try {
        const [casePayload, briefPayload] = await Promise.all([
          fetchJSON(`/api/cases/${state.selectedCaseId}`),
          fetchJSON(`/api/cases/${state.selectedCaseId}/briefs`),
        ]);
        if (cancelled) return;
        setSelectedCase(casePayload || null);
        setBriefVersions(Array.isArray(briefPayload?.items) ? briefPayload.items : []);
      } catch (err) {
        if (!cancelled) {
          const fallback = Array.isArray(items)
            ? items.find((item) => Number(item?.sighting_id) === Number(state.selectedCaseId))
            : null;
          if (fallback) {
            setSelectedCase((current) => {
              if (current && Number(current.sighting_id) === Number(state.selectedCaseId)) {
                return current;
              }
              return {
                ...fallback,
                evidence: Array.isArray(fallback.evidence) ? fallback.evidence : [],
                evidence_count: Number(fallback.evidence_count ?? 0),
                enrichment_count: Number(fallback.enrichment_count ?? 0),
                ai_briefs: Array.isArray(fallback.ai_briefs) ? fallback.ai_briefs : [],
              };
            });
          }
          setError(`Could not load case file: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingCase(false);
        }
      }
    }

    loadCase();

    return () => {
      cancelled = true;
    };
  }, [state.selectedCaseId, state.mode]);

  const refreshCompare = useCallback(async () => {
    if (state.mode !== "compare") return;
    setLoadingCompare(true);
    try {
      const payload = await postJSON("/api/compare", toComparePayload(state));
      setCompareResult(payload || { cohorts: [], baseline: null });
    } catch (err) {
      setCompareResult({ cohorts: [], baseline: null });
      setError(`Could not run compare: ${describeError(err)}`);
    } finally {
      setLoadingCompare(false);
    }
  }, [state]);

  useEffect(() => {
    refreshCompare();
  }, [refreshCompare]);

  const groupedItems = useMemo(() => groupItems(items, state.groupBy), [items, state.groupBy]);

  const updatePivot = useCallback((key, value) => {
    setState((current) => {
      const nextPivot = { ...current.pivot, [key]: value };
      if (key === "state" && !value) {
        nextPivot.city = "";
      }
      if (key === "state" && value !== current.pivot.state) {
        nextPivot.city = "";
      }
      return {
        ...current,
        pivot: nextPivot,
        offset: 0,
        sampleSetId: "",
      };
    });
  }, []);

  const updateMode = useCallback((mode) => {
    setState((current) => ({ ...current, mode: mode === "compare" ? "compare" : "explore", offset: 0 }));
  }, []);

  const togglePin = useCallback((lane) => {
    setState((current) => {
      const has = current.pin.includes(lane);
      const pin = has ? current.pin.filter((value) => value !== lane) : [...current.pin, lane];
      return { ...current, pin };
    });
  }, []);

  const setGroupBy = useCallback((groupBy) => {
    setState((current) => ({ ...current, groupBy }));
  }, []);

  const toggleColumn = useCallback((column) => {
    setState((current) => {
      const exists = current.columns.includes(column);
      let columns;
      if (exists) {
        columns = current.columns.filter((value) => value !== column);
      } else {
        columns = [...current.columns, column];
      }
      if (!columns.length) {
        columns = [...DASHBOARD_COLUMNS];
      }
      return { ...current, columns };
    });
  }, []);

  const setSignalFilter = useCallback((signal) => {
    setState((current) => ({ ...current, signal: current.signal === signal ? "" : signal, offset: 0 }));
  }, []);

  const selectCase = useCallback((sightingId) => {
    setState((current) => ({ ...current, selectedCaseId: sightingId || null }));
  }, []);

  const prevPage = useCallback(() => {
    setState((current) => ({ ...current, offset: Math.max(0, current.offset - 80) }));
  }, []);

  const nextPage = useCallback(() => {
    setState((current) => ({ ...current, offset: current.offset + 80 }));
  }, []);

  const updateCompare = useCallback((nextPatch) => {
    setState((current) => ({
      ...current,
      compare: {
        ...current.compare,
        ...nextPatch,
      },
    }));
  }, []);

  const updateSlice = useCallback(() => {
    setState((current) => ({ ...current, offset: 0 }));
  }, []);

  const openSampling = useCallback(() => setSamplingOpen(true), []);
  const closeSampling = useCallback(() => setSamplingOpen(false), []);

  const generateSample = useCallback(async () => {
    const payload = await postJSON("/api/samples/generate", toSamplePayload(state, samplingConfig));
    setSampleResult(payload || null);
    return payload;
  }, [samplingConfig, state]);

  const setSamplingOption = useCallback((patch) => {
    setSamplingConfig((current) => ({ ...current, ...patch }));
  }, []);

  const saveSampleSet = useCallback(
    async (name) => {
      if (!sampleResult?.items?.length) {
        throw new Error("Generate a sample before saving.");
      }
      const response = await postJSON("/api/sample-sets", {
        name,
        items: sampleResult.items,
        base_filters: {
          shape: state.pivot.shape || undefined,
          state: state.pivot.state || undefined,
          city: state.pivot.city || undefined,
          from_date: state.pivot.from_date || undefined,
          to_date: state.pivot.to_date || undefined,
        },
        strategy: {
          strategy: samplingConfig.strategy,
          stratify_by: samplingConfig.stratifyBy,
          size: samplingConfig.size,
        },
      });
      setState((current) => ({ ...current, sampleSetId: response.set_id || "", mode: "explore", offset: 0 }));
      await refreshSampleSets();
      return response;
    },
    [refreshSampleSets, sampleResult, samplingConfig, state.pivot]
  );

  const openSampleSet = useCallback((setId) => {
    setState((current) => ({ ...current, sampleSetId: setId || "", mode: "explore", offset: 0 }));
    setSamplingOpen(false);
  }, []);

  const clearSampleSet = useCallback(() => {
    setState((current) => ({ ...current, sampleSetId: "", offset: 0 }));
  }, []);

  const addEvidence = useCallback(
    async (evidencePayload) => {
      if (!state.selectedCaseId) {
        throw new Error("Select a case first.");
      }
      await postJSON(`/api/cases/${state.selectedCaseId}/evidence`, evidencePayload);
      const casePayload = await fetchJSON(`/api/cases/${state.selectedCaseId}`);
      setSelectedCase(casePayload || null);
    },
    [state.selectedCaseId]
  );

  const editEvidence = useCallback(
    async (evidenceId, evidencePayload) => {
      if (!state.selectedCaseId) {
        throw new Error("Select a case first.");
      }
      await patchJSON(`/api/cases/${state.selectedCaseId}/evidence/${evidenceId}`, evidencePayload);
      const casePayload = await fetchJSON(`/api/cases/${state.selectedCaseId}`);
      setSelectedCase(casePayload || null);
    },
    [state.selectedCaseId]
  );

  const generateBrief = useCallback(async () => {
    if (!state.selectedCaseId) {
      throw new Error("Select a case first.");
    }
    await postJSON(`/api/cases/${state.selectedCaseId}/briefs`, {});
    const [casePayload, briefPayload] = await Promise.all([
      fetchJSON(`/api/cases/${state.selectedCaseId}`),
      fetchJSON(`/api/cases/${state.selectedCaseId}/briefs`),
    ]);
    setSelectedCase(casePayload || null);
    setBriefVersions(Array.isArray(briefPayload?.items) ? briefPayload.items : []);
  }, [state.selectedCaseId]);

  const compareBriefVersions = useCallback(
    async (leftId, rightId) => {
      if (!state.selectedCaseId) {
        throw new Error("Select a case first.");
      }
      const payload = await fetchJSON(
        `/api/cases/${state.selectedCaseId}/briefs/compare?left=${leftId}&right=${rightId}`
      );
      setBriefDiff(payload || null);
      return payload;
    },
    [state.selectedCaseId]
  );

  const reportBriefIssue = useCallback(
    async (briefId, reasonCode, notes) => {
      if (!state.selectedCaseId) {
        throw new Error("Select a case first.");
      }
      return postJSON(`/api/cases/${state.selectedCaseId}/briefs/${briefId}/issues`, {
        reason_code: reasonCode,
        notes,
      });
    },
    [state.selectedCaseId]
  );

  const closeBriefDiff = useCallback(() => {
    setBriefDiff(null);
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

  const compareGuard = useMemo(() => {
    if (state.mode !== "compare") return "";
    if (!state.compare.cohortA || !state.compare.cohortB) {
      return "Define both cohorts before comparing.";
    }
    return "";
  }, [state.compare, state.mode]);

  return {
    state,
    options,
    stats,
    pivot,
    items,
    meta,
    groupedItems,
    compareResult,
    selectedCase,
    briefVersions,
    briefDiff,
    sampleResult,
    sampleSets,
    samplingOpen,
    samplingConfig,
    loadingMain,
    loadingStats,
    loadingCase,
    loadingCompare,
    error,
    pulse,
    compareGuard,
    updatePivot,
    updateMode,
    togglePin,
    updateSlice,
    setGroupBy,
    toggleColumn,
    setSignalFilter,
    selectCase,
    prevPage,
    nextPage,
    updateCompare,
    refreshCompare,
    openSampling,
    closeSampling,
    setSamplingOption,
    generateSample,
    saveSampleSet,
    openSampleSet,
    clearSampleSet,
    addEvidence,
    editEvidence,
    generateBrief,
    compareBriefVersions,
    reportBriefIssue,
    closeBriefDiff,
  };
}

function topSignalsFromItems(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const counts = new Map();
  for (const item of items) {
    const signals = Array.isArray(item.signals) ? item.signals : [];
    for (const signal of signals) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  const total = items.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count, pct: Number(((count / total) * 100).toFixed(1)) }));
}
