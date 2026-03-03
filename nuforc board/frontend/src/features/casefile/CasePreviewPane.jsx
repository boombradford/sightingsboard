import {
  extractReadRequest,
  formatReportNarrative,
  hasReadRequest,
  renderWithReadRequestHighlight,
} from "../../lib/reportFormatting";
import QualityBadge from "../quality/QualityBadge";
import BriefDiffModal from "./BriefDiffModal";
import BriefTabs from "./BriefTabs";
import BriefVersionTimeline from "./BriefVersionTimeline";
import EvidencePanel from "./EvidencePanel";

export default function CasePreviewPane({
  loading,
  caseItem,
  briefVersions,
  briefDiff,
  onBack,
  onCloseBriefDiff,
  onAddEvidence,
  onGenerateBrief,
  onCompareBriefs,
  onReportBriefIssue,
  onSignalClick,
}) {
  if (loading) {
    return <p className="text-sm text-slate-300">Loading case preview...</p>;
  }

  if (!caseItem) {
    return (
      <section className="glass-card flex h-full min-h-[420px] items-center justify-center p-4 text-sm text-slate-400">
        Select a case to open its file.
      </section>
    );
  }

  const narrative = formatReportNarrative(caseItem.report_text || "");
  const reporterNote = extractReadRequest(caseItem.report_text || "");

  return (
    <>
      {onBack ? (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-slate-500/40 bg-slate-900/75 px-3 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 xl:hidden"
          >
            Back To Results
          </button>
        </div>
      ) : null}
      <section className="glass-card min-h-[420px] max-h-[calc(100vh-8rem)] space-y-3 overflow-y-auto p-4 xl:max-h-[calc(100vh-13rem)]">
        <header className="grid gap-2 border-b border-slate-500/25 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100">
              Case file #{caseItem.sighting_id}
            </h2>
            <QualityBadge label={caseItem.quality_label} score={caseItem.quality_score} />
          </div>
          <p className="text-xs text-slate-300">
            {caseItem.date_time} | {caseItem.city}, {caseItem.state} | {caseItem.shape}
          </p>
          <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
            <span className="chip">Duration: {caseItem.duration || "n/a"}</span>
            <span className="chip">Observers: {caseItem.observer_count ?? "n/a"}</span>
            <span className="chip">Evidence: {caseItem.evidence_count ?? 0}</span>
            <span className="chip">Sources: {caseItem.enrichment_count ?? 0}</span>
          </div>
        </header>

        {reporterNote ? (
          <p className="rounded-lg border border-amber-300/45 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <strong className="mr-1 uppercase tracking-[0.12em]">Reporter note:</strong>
            {renderWithReadRequestHighlight(reporterNote)}
          </p>
        ) : null}

        <article className="rounded-xl border border-slate-500/30 bg-slate-950/70 p-3">
          <h3 className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-400">Narrative</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
            {hasReadRequest(narrative) ? renderWithReadRequestHighlight(narrative) : narrative || "No narrative available."}
          </p>
        </article>

        <EvidencePanel caseItem={caseItem} onAddEvidence={onAddEvidence} />

        <BriefTabs caseItem={caseItem} versions={briefVersions} onSignalClick={onSignalClick} />

        <BriefVersionTimeline
          versions={briefVersions}
          onGenerate={onGenerateBrief}
          onCompare={onCompareBriefs}
          onReportIssue={onReportBriefIssue}
        />
      </section>

      <BriefDiffModal diff={briefDiff} onClose={onCloseBriefDiff} />
    </>
  );
}
