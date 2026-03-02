import { cleanValue, formatNumber, safeText } from "./format";

export function formatCoord(value) {
  if (value == null) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toFixed(4);
}

export function buildMapLink(item) {
  if (item.city_latitude == null || item.city_longitude == null) {
    return null;
  }
  return `https://www.google.com/maps?q=${item.city_latitude},${item.city_longitude}`;
}

export function parseStatsMap(statsRaw) {
  const text = cleanValue(statsRaw);
  if (!text) {
    return {};
  }

  const out = {};
  const chunks = text
    .split(/(?:;|\|)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    let splitAt = chunk.indexOf("=");
    if (splitAt < 0) {
      splitAt = chunk.indexOf(":");
    }
    if (splitAt <= 0) {
      continue;
    }

    const key = chunk.slice(0, splitAt).trim().toLowerCase().replace(/\s+/g, "_");
    const value = chunk.slice(splitAt + 1).trim();
    if (!key || !value) {
      continue;
    }
    if (!(key in out)) {
      out[key] = value;
    }
  }

  return out;
}

export function buildFactRows(item, statsMap, narrativeText) {
  const locationFromRow = [cleanValue(item.city), cleanValue(item.state), cleanValue(statsMap.country)]
    .filter(Boolean)
    .join(", ");

  const occurred = cleanValue(statsMap.occurred || item.date_time);
  const reported = cleanValue(statsMap.reported || item.posted);
  const location = cleanValue(statsMap.location || locationFromRow);
  const shape = cleanValue(statsMap.shape || item.shape);
  const duration = cleanValue(statsMap.duration || item.duration);

  return [
    ["Occurred", occurred],
    ["Reported", reported],
    ["Location", location],
    ["Shape", shape],
    ["Duration", duration],
    ["Observers", cleanValue(statsMap.no_of_observers)],
    ["Characteristics", cleanValue(statsMap.characteristics)],
    ["Color", cleanValue(statsMap.color)],
    ["Estimated Size", cleanValue(statsMap.estimated_size)],
    ["Viewed From", cleanValue(statsMap.viewed_from)],
    ["Direction", cleanValue(statsMap.direction_from_viewer)],
    ["Elevation Angle", cleanValue(statsMap.angle_of_elevation)],
    ["Closest Distance", cleanValue(statsMap.closest_distance)],
    ["Estimated Speed", cleanValue(statsMap.estimated_speed)],
    ["Explanation", cleanValue(statsMap.explanation)],
    ["Media", cleanValue(statsMap.media)],
    [
      "Narrative Length",
      narrativeText ? `${narrativeText.split(/\s+/).filter(Boolean).length} words` : "",
    ],
  ].filter(([, value]) => value);
}

export function cardSpanClass(index) {
  if (index % 7 === 0) {
    return "md:col-span-2 2xl:col-span-12";
  }
  if (index % 3 === 0) {
    return "2xl:col-span-4";
  }
  return "2xl:col-span-6";
}

export function formatMeta(meta) {
  const total = Number(meta?.total || 0);
  const returned = Number(meta?.returned || 0);
  const offset = Number(meta?.offset || 0);
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + returned, total);
  const order = safeText(meta?.order, "recent");
  return `Showing ${formatNumber(start)}-${formatNumber(end)} of ${formatNumber(total)} (${order})`;
}
