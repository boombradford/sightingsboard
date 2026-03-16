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

/**
 * Render AI brief text with inline formatting.
 * Supports **bold**, "quoted phrases", and leading label: patterns.
 */
export function formatBriefText(text) {
  const raw = String(text || "");
  if (!raw) return "";

  // Split on **bold** and "quoted" segments
  const tokens = raw.split(/(\*\*[^*]+\*\*|"[^"]{2,}")/g);

  return tokens.map((token, i) => {
    // **bold**
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // "quoted phrase"
    if (token.startsWith('"') && token.endsWith('"') && token.length > 4) {
      return (
        <span key={i} className="italic text-zinc-300">
          {token}
        </span>
      );
    }
    // Leading label pattern: "Duration:" or "Shape:" at start of bullet
    if (i === 0) {
      const labelMatch = token.match(/^([A-Z][a-z]+(?:\s[a-z]+)?:\s?)/);
      if (labelMatch) {
        return (
          <span key={i}>
            <span className="font-semibold text-zinc-300">{labelMatch[1]}</span>
            {token.slice(labelMatch[1].length)}
          </span>
        );
      }
    }
    return <span key={i}>{token}</span>;
  });
}

/**
 * Break a long single-paragraph block into paragraphs at natural topic shifts.
 * Looks for sentence boundaries where the next sentence starts a new thought
 * (time shifts, topic pivots, contrast markers, personal reflections).
 */
function insertParagraphBreaks(text) {
  // Only process blocks that are long enough to need breaks and have no existing breaks
  if (text.length < 300 || text.includes("\n\n")) return text;

  // Patterns that signal a paragraph break before them
  const breakBefore = [
    /(?<=[.!?])\s+(?=I (?:spent|watched|waited|looked|stayed|went|drove|called|decided|couldn't|can't|know|believe|feel|think|also|have|had))/g,
    /(?<=[.!?])\s+(?=(?:It|This|That|The next|The following|From my|In my|At (?:this|that|around)|After|Before|Later|Eventually|Suddenly|Then|But|However|Also|Meanwhile|About|Around|Approximately)\b)/g,
    /(?<=[.!?])\s+(?=(?:I'm|It's|I've|I'd|We|They|He|She|My|Our|There)\b)/g,
    /(?<=[.!?])\s+(?=Posted\s+\d{4})/g,
  ];

  let result = text;
  for (const pattern of breakBefore) {
    result = result.replace(pattern, "\n\n");
  }

  // Prevent too many short paragraphs — merge any paragraph under ~80 chars
  // back into the previous one
  const paragraphs = result.split(/\n\n+/);
  const merged = [];
  for (const para of paragraphs) {
    if (merged.length > 0 && merged[merged.length - 1].length < 80) {
      merged[merged.length - 1] += " " + para;
    } else {
      merged.push(para);
    }
  }

  return merged.join("\n\n");
}

export function formatReportNarrative(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  let formatted = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  formatted = formatted.replace(/Reporter\s*note:\s*/gi, "Reporter note: ");
  formatted = formatted.replace(
    /(Reporter note:\s*please read(?: this| the| the below| below)?(?: report| and the end)?)/i,
    "$1\n\n"
  );
  formatted = formatted.replace(
    /(Please read(?: this| the| the below| below)?\s+report)\s+(UNIDENTIFIED AERIAL PHENOMENA REPORT)/i,
    "$1\n\n$2"
  );
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
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  // Break up wall-of-text narratives into readable paragraphs
  formatted = insertParagraphBreaks(formatted);

  return formatted;
}
