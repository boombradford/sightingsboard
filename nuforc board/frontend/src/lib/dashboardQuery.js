const DEFAULT_COLUMNS = [
  "date_time",
  "location",
  "shape",
  "score",
  "signals",
];

export const DEFAULT_DASHBOARD_STATE = {
  mode: "explore",
  keyword: "",
  pivot: {
    shape: "",
    state: "",
    city: "",
    from_date: "",
    to_date: "",
    has_description: false,
  },
  pin: [],
  groupBy: "none",
  columns: DEFAULT_COLUMNS,
  signal: "",
  order: "recent",
  sampleSetId: "",
  selectedCaseId: null,
  offset: 0,
  compare: {
    dimension: "shape",
    includeBaseline: true,
    cohortA: "",
    cohortB: "",
  },
};

function parseIntSafe(value, fallback = 0) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function parseDashboardSearch(search) {
  const params = new URLSearchParams(search || "");
  const validModes = ["explore", "compare", "pipeline", "discover"];
  const rawMode = params.get("mode") || "explore";
  const mode = validModes.includes(rawMode) ? rawMode : "explore";

  const state = {
    ...DEFAULT_DASHBOARD_STATE,
    mode,
    keyword: params.get("keyword") || "",
    pivot: {
      shape: params.get("pivot_shape") || "",
      state: params.get("pivot_state") || "",
      city: params.get("pivot_city") || "",
      from_date: params.get("pivot_from") || "",
      to_date: params.get("pivot_to") || "",
      has_description: params.get("has_desc") === "1",
    },
    pin: params
      .getAll("pin")
      .map((value) => value.trim())
      .filter((value) => value === "shape" || value === "place" || value === "date"),
    groupBy: params.get("group_by") || "none",
    columns: params.get("columns")
      ? params
          .get("columns")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : DEFAULT_COLUMNS,
    signal: params.get("signal") || "",
    order: params.get("order") || "recent",
    sampleSetId: params.get("sample_set") || "",
    selectedCaseId: params.get("case") ? parseIntSafe(params.get("case"), 0) || null : null,
    offset: parseIntSafe(params.get("offset"), 0),
    compare: {
      dimension: params.get("compare_dimension") || "shape",
      includeBaseline: params.get("baseline") !== "0",
      cohortA: params.get("cohort_a") || "",
      cohortB: params.get("cohort_b") || "",
    },
  };

  if (!state.pivot.state) {
    state.pivot.city = "";
  }
  if (!state.columns.length) {
    state.columns = DEFAULT_COLUMNS;
  }
  if (!["shape", "place", "date-range"].includes(state.compare.dimension)) {
    state.compare.dimension = "shape";
  }

  return state;
}

export function buildDashboardSearch(state) {
  const params = new URLSearchParams();

  if (state.mode !== DEFAULT_DASHBOARD_STATE.mode) {
    params.set("mode", state.mode);
  }

  if (state.keyword) params.set("keyword", state.keyword);

  if (state.pivot.shape) params.set("pivot_shape", state.pivot.shape);
  if (state.pivot.state) params.set("pivot_state", state.pivot.state);
  if (state.pivot.city) params.set("pivot_city", state.pivot.city);
  if (state.pivot.from_date) params.set("pivot_from", state.pivot.from_date);
  if (state.pivot.to_date) params.set("pivot_to", state.pivot.to_date);
  if (state.pivot.has_description) params.set("has_desc", "1");

  for (const lane of state.pin || []) {
    if (lane === "shape" || lane === "place" || lane === "date") {
      params.append("pin", lane);
    }
  }

  if (state.groupBy && state.groupBy !== "none") {
    params.set("group_by", state.groupBy);
  }

  const columns = Array.isArray(state.columns) ? state.columns.filter(Boolean) : [];
  if (columns.length && columns.join(",") !== DEFAULT_COLUMNS.join(",")) {
    params.set("columns", columns.join(","));
  }

  if (state.signal) params.set("signal", state.signal);
  if (state.order && state.order !== "recent") params.set("order", state.order);
  if (state.sampleSetId) params.set("sample_set", state.sampleSetId);
  if (state.selectedCaseId) params.set("case", String(state.selectedCaseId));
  if (state.offset > 0) params.set("offset", String(state.offset));

  if (state.compare.dimension && state.compare.dimension !== "shape") {
    params.set("compare_dimension", state.compare.dimension);
  }
  if (state.compare.cohortA) params.set("cohort_a", state.compare.cohortA);
  if (state.compare.cohortB) params.set("cohort_b", state.compare.cohortB);
  if (!state.compare.includeBaseline) params.set("baseline", "0");

  return params.toString();
}

export function toSightingQuery(state, pageSize = 80) {
  const params = new URLSearchParams();
  if (state.pivot.shape) params.set("shape", state.pivot.shape);
  if (state.pivot.state) params.set("state", state.pivot.state);
  if (state.pivot.city) params.set("city", state.pivot.city);
  if (state.pivot.from_date) params.set("from_date", state.pivot.from_date);
  if (state.pivot.to_date) params.set("to_date", state.pivot.to_date);
  if (state.pivot.has_description) params.set("has_description", "1");
  if (state.keyword) params.set("keyword", state.keyword);
  params.set("order", state.order || "recent");
  params.set("limit", String(pageSize));
  params.set("offset", String(Math.max(0, Number(state.offset) || 0)));
  return params;
}

export function toPivotQuery(state) {
  const params = new URLSearchParams();
  if (state.pivot.shape) params.set("shape", state.pivot.shape);
  if (state.pivot.state) params.set("state", state.pivot.state);
  if (state.pivot.city) params.set("city", state.pivot.city);
  if (state.pivot.from_date) params.set("from_date", state.pivot.from_date);
  if (state.pivot.to_date) params.set("to_date", state.pivot.to_date);
  if (state.pivot.has_description) params.set("has_description", "1");
  for (const lane of state.pin || []) {
    params.append("pinned", lane);
  }
  params.set("date_bucket", "month");
  return params;
}

export function toComparePayload(state) {
  const dimension = state.compare.dimension || "shape";
  const filterKey = dimension === "place" ? "state" : "shape";
  const baseFilters = {
    shape: state.pivot.shape || undefined,
    state: state.pivot.state || undefined,
    city: state.pivot.city || undefined,
    from_date: state.pivot.from_date || undefined,
    to_date: state.pivot.to_date || undefined,
  };

  const cohortAValue = state.compare.cohortA || "";
  const cohortBValue = state.compare.cohortB || "";

  const cohorts = [
    {
      id: "A",
      label: cohortAValue || "Cohort A",
      filter: dimension === "date-range" ? { from_date: cohortAValue } : { [filterKey]: cohortAValue },
    },
    {
      id: "B",
      label: cohortBValue || "Cohort B",
      filter: dimension === "date-range" ? { to_date: cohortBValue } : { [filterKey]: cohortBValue },
    },
  ];

  return {
    dimension,
    cohorts,
    include_baseline: Boolean(state.compare.includeBaseline),
    sample_size: 10,
    base_filters: baseFilters,
  };
}

export function toSamplePayload(state, samplingConfig) {
  return {
    base_filters: {
      shape: state.pivot.shape || undefined,
      state: state.pivot.state || undefined,
      city: state.pivot.city || undefined,
      from_date: state.pivot.from_date || undefined,
      to_date: state.pivot.to_date || undefined,
    },
    size: samplingConfig.size,
    strategy: samplingConfig.strategy,
    stratify_by: samplingConfig.stratifyBy,
    constraints: {
      has_coordinates: samplingConfig.hasCoordinates,
      has_sources: samplingConfig.hasSources,
      has_media: samplingConfig.hasMedia,
    },
  };
}

export function buildCaseFromItems(items, current) {
  if (!Array.isArray(items) || !items.length) return null;
  if (current && items.some((item) => item.sighting_id === current)) return current;
  return items[0].sighting_id;
}

export const DASHBOARD_COLUMNS = DEFAULT_COLUMNS;
