import { cleanValue } from "./format";

export const INITIAL_FILTERS = {
  keyword: "",
  state: "",
  shape: "",
  from_date: "",
  to_date: "",
  order: "recent",
  limit: "20",
};

const FILTER_KEYS = ["keyword", "state", "shape", "from_date", "to_date", "order", "limit"];
const ORDER_VALUES = new Set(["recent", "oldest", "random"]);
const LIMIT_VALUES = new Set(["20", "40", "80", "120"]);

export function normalizeFilters(next) {
  const normalized = { ...INITIAL_FILTERS };

  for (const key of FILTER_KEYS) {
    if (!(key in next)) continue;
    normalized[key] = cleanValue(next[key]);
  }

  if (!ORDER_VALUES.has(normalized.order)) {
    normalized.order = INITIAL_FILTERS.order;
  }

  if (!LIMIT_VALUES.has(normalized.limit)) {
    normalized.limit = INITIAL_FILTERS.limit;
  }

  return normalized;
}

export function parseQueryState(search) {
  const params = new URLSearchParams(search);
  const nextFilters = {};

  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value != null) {
      nextFilters[key] = value;
    }
  }

  const normalizedFilters = normalizeFilters(nextFilters);
  const rawOffset = Number.parseInt(params.get("offset") || "0", 10);
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return {
    filters: normalizedFilters,
    offset,
  };
}

export function buildApiQuery(filters, offset) {
  const params = new URLSearchParams();
  const normalized = normalizeFilters(filters);

  for (const key of FILTER_KEYS) {
    const value = cleanValue(normalized[key]);
    if (value) {
      params.set(key, value);
    }
  }

  params.set("offset", String(Math.max(0, Number(offset) || 0)));
  return params;
}

export function buildUrlSearch(filters, offset) {
  const params = new URLSearchParams();
  const normalized = normalizeFilters(filters);

  for (const key of FILTER_KEYS) {
    const value = cleanValue(normalized[key]);
    if (!value) continue;
    if (normalized[key] === INITIAL_FILTERS[key]) continue;
    params.set(key, value);
  }

  const safeOffset = Math.max(0, Number(offset) || 0);
  if (safeOffset > 0) {
    params.set("offset", String(safeOffset));
  }

  return params.toString();
}
