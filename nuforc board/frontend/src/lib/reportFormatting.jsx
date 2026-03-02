const READ_REQUEST_SOURCE = "(please read(?: this| the| the below| below)?(?: report| and the end)?)";
const READ_REPORT_SOURCE = "(please read(?: this| the| the below| below)?\\s+report)";
const REPORT_SECTION_LABELS = [
  "Dates observed",
  "Observed from",
  "Object appeared",
  "Number of objects",
  "Witnesses",
  "Weather conditions",
  "Description of object",
  "Altitude estimate",
  "Movement pattern",
  "Sound",
  "Evidence collected",
];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasReadRequest(text) {
  const pattern = new RegExp(READ_REQUEST_SOURCE, "i");
  return pattern.test(String(text || ""));
}

export function renderWithReadRequestHighlight(text, highlightClassName = "font-semibold text-amber-200") {
  const raw = String(text || "");
  if (!raw) return "";

  const pattern = new RegExp(READ_REQUEST_SOURCE, "gi");
  const parts = raw.split(pattern);

  return parts.map((part, index) => {
    if (part.match(pattern)) {
      return (
        <span key={`read-request-${index}`} className={highlightClassName}>
          {part}
        </span>
      );
    }
    return <span key={`plain-${index}`}>{part}</span>;
  });
}

export function extractReadRequest(text) {
  const raw = String(text || "");
  const withReportPattern = new RegExp(READ_REPORT_SOURCE, "i");
  const withReport = raw.match(withReportPattern);
  if (withReport) return withReport[0];

  const fallbackPattern = new RegExp(READ_REQUEST_SOURCE, "i");
  const fallback = raw.match(fallbackPattern);
  return fallback ? fallback[0] : "";
}

export function formatReportNarrative(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  let formatted = raw.replace(/\s+/g, " ").trim();
  formatted = formatted.replace(
    /(UNIDENTIFIED AERIAL PHENOMENA REPORT)\s+/i,
    "$1\n\n"
  );

  const headingsPattern = new RegExp(
    `\\s(?=(${REPORT_SECTION_LABELS.map(escapeRegex).join("|")}):)`,
    "gi"
  );
  formatted = formatted.replace(headingsPattern, "\n\n");

  formatted = formatted.replace(/\s*•\s*/g, "\n• ");
  return formatted;
}
