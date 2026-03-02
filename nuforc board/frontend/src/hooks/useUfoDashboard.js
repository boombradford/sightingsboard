import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJSON, postJSON } from "../lib/api";
import { describeError, formatNumber } from "../lib/format";
import {
  INITIAL_FILTERS,
  buildApiQuery,
  buildUrlSearch,
  normalizeFilters,
  parseQueryState,
} from "../lib/queryState";

function parseCurrentQueryState() {
  if (typeof window === "undefined") {
    return { filters: INITIAL_FILTERS, offset: 0 };
  }
  return parseQueryState(window.location.search);
}

export function useUfoDashboard() {
  const initialState = useMemo(parseCurrentQueryState, []);

  const [draftFilters, setDraftFilters] = useState(initialState.filters);
  const [appliedFilters, setAppliedFilters] = useState(initialState.filters);
  const [offset, setOffset] = useState(initialState.offset);

  const [options, setOptions] = useState({ states: [], shapes: [] });
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({
    total: 0,
    returned: 0,
    offset: initialState.offset,
    order: initialState.filters.order,
  });
  const [aiBriefs, setAiBriefs] = useState({});

  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadError, setLoadError] = useState("");

  const requestSeq = useRef(0);
  const controllerRef = useRef(null);

  const pageSize = Number(appliedFilters.limit || 20);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseCurrentQueryState();
      setDraftFilters(next.filters);
      setAppliedFilters(next.filters);
      setOffset(next.offset);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const search = buildUrlSearch(appliedFilters, offset);
    const nextUrl = search
      ? `${window.location.pathname}?${search}`
      : `${window.location.pathname}`;

    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [appliedFilters, offset]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptionsAndStats() {
      setLoadingStats(true);
      try {
        const [optionsPayload, statsPayload] = await Promise.all([
          fetchJSON("/api/options"),
          fetchJSON("/api/stats"),
        ]);

        if (cancelled) return;

        setOptions({
          states: Array.isArray(optionsPayload.states) ? optionsPayload.states : [],
          shapes: Array.isArray(optionsPayload.shapes) ? optionsPayload.shapes : [],
        });
        setStats(statsPayload);
      } catch (err) {
        if (!cancelled) {
          setLoadError(`Could not load options/stats: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    loadOptionsAndStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const queryString = useMemo(
    () => buildApiQuery(appliedFilters, offset).toString(),
    [appliedFilters, offset]
  );

  useEffect(() => {
    const currentSeq = ++requestSeq.current;

    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    async function loadSightings() {
      setLoading(true);
      setLoadError("");
      try {
        const payload = await fetchJSON(`/api/sightings?${queryString}`, {
          signal: controller.signal,
        });

        if (currentSeq !== requestSeq.current) return;

        const incomingItems = Array.isArray(payload.items) ? payload.items : [];
        const incomingMeta = payload.meta || {};

        setItems(incomingItems);
        setMeta({
          total: Number(incomingMeta.total || 0),
          returned: Number(incomingMeta.returned || 0),
          offset: Number(incomingMeta.offset || 0),
          order: String(incomingMeta.order || "recent"),
        });

        const incomingBriefs = {};
        for (const item of incomingItems) {
          if (item?.ai_brief && item?.sighting_id != null) {
            incomingBriefs[item.sighting_id] = item.ai_brief;
          }
        }
        if (Object.keys(incomingBriefs).length) {
          setAiBriefs((current) => ({ ...current, ...incomingBriefs }));
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        if (currentSeq !== requestSeq.current) {
          return;
        }

        setItems([]);
        setMeta((current) => ({ ...current, returned: 0 }));
        setLoadError(`Could not load sightings: ${describeError(err)}`);
      } finally {
        if (currentSeq === requestSeq.current) {
          setLoading(false);
        }
      }
    }

    loadSightings();

    return () => {
      controller.abort();
    };
  }, [queryString]);

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setDraftFilters((current) => ({ ...current, [name]: value }));
  }, []);

  const applyFilters = useCallback((nextFilters) => {
    const normalized = normalizeFilters(nextFilters);
    setOffset(0);
    setAppliedFilters(normalized);
    setDraftFilters(normalized);
  }, []);

  const applyDraftFilters = useCallback(() => {
    applyFilters(draftFilters);
  }, [applyFilters, draftFilters]);

  const randomizeFilters = useCallback(() => {
    const next = normalizeFilters({ ...draftFilters, order: "random" });
    setDraftFilters(next);
    setOffset(0);
    setAppliedFilters(next);
  }, [draftFilters]);

  const resetFilters = useCallback(() => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setOffset(0);
  }, []);

  const prevPage = useCallback(() => {
    setOffset((current) => Math.max(0, current - pageSize));
  }, [pageSize]);

  const nextPage = useCallback(() => {
    setOffset((current) => current + pageSize);
  }, [pageSize]);

  const generateBrief = useCallback(async (sightingId) => {
    const response = await postJSON("/api/enrich", { sighting_id: sightingId });
    setAiBriefs((current) => ({ ...current, [sightingId]: response.brief }));
    return response;
  }, []);

  const queryChips = useMemo(() => {
    const chips = [];
    if (appliedFilters.keyword) chips.push(`keyword:${appliedFilters.keyword}`);
    if (appliedFilters.state) chips.push(`state:${appliedFilters.state}`);
    if (appliedFilters.shape) chips.push(`shape:${appliedFilters.shape}`);
    if (appliedFilters.from_date) chips.push(`from:${appliedFilters.from_date}`);
    if (appliedFilters.to_date) chips.push(`to:${appliedFilters.to_date}`);
    chips.push(`order:${appliedFilters.order}`);
    chips.push(`rows:${meta.returned}/${meta.total}`);
    return chips;
  }, [appliedFilters, meta.returned, meta.total]);

  const snapshotLine = useMemo(() => {
    return `Showing ${formatNumber(meta.returned)} records on this page out of ${formatNumber(meta.total)} matching sightings.`;
  }, [meta.returned, meta.total]);

  const geocodedPct = useMemo(() => {
    const total = Number(stats?.total_sightings || 0);
    const geocoded = Number(stats?.geocoded_sightings || 0);
    if (!total) return "0.0";
    return ((geocoded / total) * 100).toFixed(1);
  }, [stats]);

  const prevDisabled = loading || offset <= 0;
  const nextDisabled = loading || offset + Number(meta.returned || 0) >= Number(meta.total || 0);

  return {
    draftFilters,
    options,
    stats,
    items,
    meta,
    aiBriefs,
    loading,
    loadingStats,
    loadError,
    queryChips,
    snapshotLine,
    geocodedPct,
    prevDisabled,
    nextDisabled,
    handleInputChange,
    applyDraftFilters,
    randomizeFilters,
    resetFilters,
    prevPage,
    nextPage,
    generateBrief,
  };
}
