import { m } from "motion/react";
import {
  extractReadRequest,
  formatReportNarrative,
  hasReadRequest,
  renderWithReadRequestHighlight,
} from "../../lib/reportFormatting";
import { fadeUp } from "../../lib/motion";
import QualityBadge from "../quality/QualityBadge";
import Badge from "../shared/Badge";
import { SkeletonCard } from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
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
    return (
      <div className="p-4 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <EmptyState
        icon={<span>&#128269;</span>}
        title="No case selected"
        description="Select a sighting from the table to view its case file."
      />
    );
  }

  const narrative = formatReportNarrative(caseItem.report_text || "");
  const reporterNote = extractReadRequest(caseItem.report_text || "");

  return (
    <>
      {onBack && (
        <div className="border-b border-white/[0.06] p-3 xl:hidden">
          <button
            type="button"
            onClick={onBack}
            className="text-caption text-slate-400 hover:text-slate-200"
          >
            &larr; Back to results
          </button>
        </div>
      )}

      <m.div
        className="space-y-4 p-4 overflow-y-auto"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <header className="space-y-2 border-b border-white/[0.06] pb-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-body font-semibold text-slate-100">
              Case #{caseItem.sighting_id}
            </h2>
            <QualityBadge label={caseItem.quality_label} score={caseItem.quality_score} />
          </div>
          <p className="text-caption text-slate-400">
            {caseItem.date_time} &middot; {caseItem.city}, {caseItem.state} &middot; {caseItem.shape}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">{caseItem.duration || "n/a"}</Badge>
            <Badge variant="neutral">{caseItem.observer_count ?? "?"} obs.</Badge>
            <Badge variant="info">{caseItem.evidence_count ?? 0} evid.</Badge>
            <Badge variant="accent">{caseItem.enrichment_count ?? 0} src.</Badge>
          </div>
        </header>

        {/* Reporter note */}
        {reporterNote && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-caption text-amber-200">
            <span className="text-micro font-medium text-amber-400/80 mr-1">Reporter note:</span>
            {renderWithReadRequestHighlight(reporterNote)}
          </div>
        )}

        {/* Narrative */}
        <div className="rounded-lg border border-white/[0.04] bg-surface-deepest/60 p-3">
          <p className="mb-2 text-micro font-medium text-slate-500">Narrative</p>
          <p className="whitespace-pre-wrap break-words text-caption leading-relaxed text-slate-300">
            {hasReadRequest(narrative) ? renderWithReadRequestHighlight(narrative) : narrative || "No narrative available."}
          </p>
        </div>

        <EvidencePanel caseItem={caseItem} onAddEvidence={onAddEvidence} />
        <BriefTabs caseItem={caseItem} versions={briefVersions} onSignalClick={onSignalClick} />
        <BriefVersionTimeline
          versions={briefVersions}
          onGenerate={onGenerateBrief}
          onCompare={onCompareBriefs}
          onReportIssue={onReportBriefIssue}
        />
      </m.div>

      <BriefDiffModal diff={briefDiff} onClose={onCloseBriefDiff} />
    </>
  );
}
