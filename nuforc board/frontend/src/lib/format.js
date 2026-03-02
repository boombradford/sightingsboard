export function cx(...values) {
  return values.filter(Boolean).join(" ");
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function safeText(value, fallback = "unknown") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function cleanValue(value) {
  return String(value ?? "").trim();
}

export function describeError(err) {
  if (err && typeof err === "object" && "message" in err) {
    return String(err.message);
  }
  return "Unexpected error";
}
