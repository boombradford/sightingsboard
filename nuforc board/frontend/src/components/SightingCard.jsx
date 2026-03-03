import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { m } from "motion/react";
import { buttonMotion, cardVariants } from "../lib/motion";
import { cleanValue, describeError, safeText, cx } from "../lib/format";
import {
  extractReadRequest,
  formatReportNarrative,
  hasReadRequest,
  renderWithReadRequestHighlight,
} from "../lib/reportFormatting";
import {
  buildFactRows,
  buildMapLink,
  formatCoord,
  parseStatsMap,
} from "../lib/sighting";
import AiBriefBlock from "./AiBriefBlock";

const SightingCard = memo(function SightingCard({ item, index, brief, onGenerateBrief }) {
  const narrative = cleanValue(item.report_text || item.summary);
  const summaryText = safeText(item.summary, "(No summary)");
  const formattedNarrative = useMemo(() => formatReportNarrative(narrative), [narrative]);
  const narrativeCap = 1300;
  const canToggleNarrative = formattedNarrative.length > narrativeCap;
  const statsMap = useMemo(() => parseStatsMap(item.stats), [item.stats]);
  const facts = useMemo(() => buildFactRows(item, statsMap, narrative), [item, statsMap, narrative]);
  const mapLink = useMemo(() => buildMapLink(item), [item.city_latitude, item.city_longitude]);
  const sources = Array.isArray(item.enrichment_sources) ? item.enrichment_sources : [];
  const readRequestText = useMemo(
    () => extractReadRequest(narrative || item.summary || ""),
    [item.summary, narrative]
  );
  const hasReadRequestInSummary = useMemo(() => hasReadRequest(summaryText), [summaryText]);
  const hasReadRequestInNarrative = useMemo(
    () => hasReadRequest(formattedNarrative),
    [formattedNarrative]
  );

  const [expandedNarrative, setExpandedNarrative] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState(brief ? "AI brief available." : "No AI brief generated yet.");

  useEffect(() => {
    if (brief) {
      setAiStatus("AI brief available.");
    }
  }, [brief]);

  const lat = formatCoord(item.city_latitude);
  const lon = formatCoord(item.city_longitude);
  const shownNarrative =
    canToggleNarrative && !expandedNarrative
      ? `${formattedNarrative.slice(0, narrativeCap)}...`
      : formattedNarrative;

  const handleGenerateBrief = useCallback(async () => {
    setAiBusy(true);
    setAiStatus("Generating AI brief...");
    try {
      const response = await onGenerateBrief(item.sighting_id);
      setAiStatus(response.cached ? "Loaded from AI cache." : "AI brief generated.");
    } catch (err) {
      setAiStatus(`AI brief failed: ${describeError(err)}`);
    } finally {
      setAiBusy(false);
    }
  }, [item.sighting_id, onGenerateBrief]);

  return (
    <m.article
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.993 }}
      className={cx("glass-card grid gap-4 rounded-2xl p-5")}
    >
      <header className="grid gap-1">
        <p className="text-[11px] text-slate-400">
          <span className="font-mono">{safeText(item.date_time)}</span>
          <span className="mx-1 text-slate-500">•</span>
          <span className="font-mono">
            {safeText(item.city, "unknown-city")}, {safeText(item.state, "--")}
          </span>
        </p>
        <p className="text-sm">
          <strong className="mr-2 text-amber-300">{safeText(item.shape, "unknown-shape")}</strong>
          <span className="font-mono text-xs text-slate-400">#{item.sighting_id}</span>
        </p>
      </header>

      <p className="break-words text-sm leading-relaxed text-slate-200">
        {hasReadRequestInSummary ? renderWithReadRequestHighlight(summaryText) : summaryText}
      </p>

      <div className="flex flex-wrap gap-1.5">
        <span className="chip">Duration: {safeText(item.duration, "unknown")}</span>
        <span className="chip">Posted: {safeText(item.posted, "unknown")}</span>
        <span className="chip">{lat && lon ? `Coords: ${lat}, ${lon}` : "Coords: unavailable"}</span>
        <span className="chip">Sources: {item.enrichment_count ?? 0}</span>
      </div>

      <details className="rounded-xl border border-slate-500/35 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-xs font-mono uppercase tracking-[0.16em] text-slate-300">
          Open case details
        </summary>
        <div className="mt-3 grid gap-3">
          <div className="rounded-lg border border-slate-500/35 bg-slate-900/70 p-2.5">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-200">Sighting facts</h4>
            {facts.length ? (
              <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[minmax(110px,0.7fr)_1fr]">
                {facts.map(([label, value]) => (
                  <div key={`${item.sighting_id}-${label}`} className="contents">
                    <dt className="font-mono text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="text-xs leading-relaxed text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-slate-300">No structured sighting details available for this record.</p>
            )}
          </div>

          <div className="grid gap-2">
            {readRequestText ? (
              <p className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <strong className="mr-1 uppercase tracking-wide">Reporter note:</strong>{" "}
                {renderWithReadRequestHighlight(readRequestText)}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
              {narrative
                ? hasReadRequestInNarrative
                  ? renderWithReadRequestHighlight(shownNarrative)
                  : shownNarrative
                : "No narrative available."}
            </p>
            {canToggleNarrative ? (
              <m.button
                type="button"
                {...buttonMotion}
                onClick={() => setExpandedNarrative((current) => !current)}
                className="w-fit rounded-lg border border-slate-500/40 bg-slate-900/85 px-3 py-1 text-xs font-mono text-slate-200"
              >
                {expandedNarrative ? "Show less" : "Show full narrative"}
              </m.button>
            ) : null}
            <p className="text-xs font-mono text-slate-400">
              {item.stats ? `Raw stats: ${item.stats}` : "Raw stats: unavailable"}
            </p>
          </div>

          <div className="grid gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
              Linked enrichment sources
            </h4>
            {sources.length ? (
              <ul className="grid gap-1.5 pl-4 text-xs text-slate-300">
                {sources.map((source, sourceIdx) => {
                  const support = safeText(source.supports_or_contradicts, "unknown");
                  const confidence =
                    source.confidence_0_to_1 == null ? "n/a" : Number(source.confidence_0_to_1).toFixed(2);
                  const title = safeText(source.source_title, "Untitled source");
                  const publisher = safeText(source.publisher, "unknown publisher");

                  return (
                    <li key={`${item.sighting_id}-source-${sourceIdx}`} className="break-words">
                      {source.source_url ? (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-300 underline-offset-2 hover:underline"
                        >
                          {title}
                        </a>
                      ) : (
                        <span>{title}</span>
                      )}
                      <span>{` - ${publisher} | stance: ${support} | confidence: ${confidence}`}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-slate-300">No enrichment sources linked for this sighting yet.</p>
            )}
          </div>

          <div className="grid gap-2 rounded-lg border border-slate-500/35 bg-slate-950/65 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-200">AI Case Brief</h4>
              <m.button
                type="button"
                {...buttonMotion}
                onClick={handleGenerateBrief}
                disabled={aiBusy}
                className="rounded-full border border-slate-400/45 bg-gradient-to-r from-emerald-700/90 to-cyan-700/90 px-3 py-1 text-[11px] font-mono uppercase tracking-wide text-emerald-50 disabled:opacity-60"
              >
                {brief ? "Regenerate" : "Generate"}
              </m.button>
            </div>
            <p className="text-xs font-mono text-slate-400">{aiStatus}</p>
            {brief ? (
              <div className="grid gap-2">
                <AiBriefBlock title="Case summary" content={brief.case_summary || ""} />
                <AiBriefBlock title="Likely explanations" content={brief.likely_explanations || []} />
                <AiBriefBlock title="Research leads" content={brief.research_leads || []} />
                <AiBriefBlock title="Source-based notes" content={brief.source_based_notes || []} />
                <p className="text-xs font-mono text-slate-400">
                  Overall confidence: {brief.overall_confidence_0_to_1 == null ? "n/a" : Number(brief.overall_confidence_0_to_1).toFixed(2)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </details>

      <footer className="flex flex-wrap gap-3 text-xs">
        {item.report_link ? (
          <a
            href={item.report_link}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Original report
          </a>
        ) : (
          <span className="text-slate-500">No source URL</span>
        )}
        {mapLink ? (
          <a
            href={mapLink}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Map
          </a>
        ) : (
          <span className="text-slate-500">No coordinates</span>
        )}
      </footer>
    </m.article>
  );
});

export default SightingCard;
