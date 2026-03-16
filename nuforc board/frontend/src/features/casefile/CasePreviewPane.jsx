import { m } from "motion/react";
import {
  extractReadRequest,
  formatBriefText,
  formatReportNarrative,
  hasReadRequest,
  renderWithReadRequestHighlight,
} from "../../lib/reportFormatting";
import { fadeUp } from "../../lib/motion";
import QualityBadge from "../quality/QualityBadge";
import ShapeIcon from "../shared/ShapeIcon";
import Badge from "../shared/Badge";
import CollapsibleSection from "../shared/CollapsibleSection";
import { SkeletonCard } from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import ScoreGauge from "./ScoreGauge";
import BriefDiffModal from "./BriefDiffModal";
import BriefTabs from "./BriefTabs";
import BriefVersionTimeline from "./BriefVersionTimeline";
import EvidencePanel from "./EvidencePanel";
import CopyForScriptButton from "./CopyForScriptButton";
import ContextPanel from "./ContextPanel";
import StoryScoreBreakdown from "./StoryScoreBreakdown";

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
  onToggleBookmark,
  onUpdateBookmark,
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
  const brief = caseItem.latest_brief?.brief || caseItem.ai_brief;
  const synopsisBullets = brief?.summary?.synopsis_bullets;

  return (
    <>
      {onBack && (
        <div className="border-b border-zinc-800 p-3 xl:hidden">
          <button
            type="button"
            onClick={onBack}
            className="text-caption text-zinc-300 hover:text-zinc-200"
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
        <header className="space-y-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-body font-semibold text-zinc-100">
              Case <span className="font-mono text-amber-400">#{caseItem.sighting_id}</span>
            </h2>
            <div className="flex items-center gap-2">
              {caseItem.story_score != null && (
                <ScoreGauge score={caseItem.story_score} size={44} />
              )}
              <QualityBadge label={caseItem.quality_label} score={caseItem.quality_score} />
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 font-mono text-micro text-zinc-400 sm:text-caption">
            <span>{caseItem.date_time}</span>
            <span className="text-zinc-600">/</span>
            <span>{caseItem.city}, {caseItem.state}</span>
            <span className="text-zinc-600">/</span>
            <span className="inline-flex items-center gap-1">
              <ShapeIcon shape={caseItem.shape} size={13} className="text-zinc-300" />
              <span className="capitalize">{caseItem.shape}</span>
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="neutral">{caseItem.duration || "n/a"}</Badge>
            <Badge variant="neutral">{caseItem.observer_count ?? "?"} obs.</Badge>
            <Badge variant="info">{caseItem.evidence_count ?? 0} evid.</Badge>
            <Badge variant="accent">{caseItem.enrichment_count ?? 0} src.</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CopyForScriptButton caseItem={caseItem} />
            {onToggleBookmark && (
              <button
                type="button"
                onClick={() => onToggleBookmark(caseItem.sighting_id, caseItem.is_bookmarked)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-micro font-medium transition-colors ${
                  caseItem.is_bookmarked
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={caseItem.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {caseItem.is_bookmarked ? "Saved" : "Save"}
              </button>
            )}
            {caseItem.is_bookmarked && onUpdateBookmark && (
              <select
                value={caseItem.bookmark_status || "new"}
                onChange={(e) => onUpdateBookmark(caseItem.sighting_id, { status: e.target.value })}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-micro text-zinc-300"
              >
                <option value="new">New</option>
                <option value="scripted">Scripted</option>
                <option value="filmed">Filmed</option>
                <option value="published">Published</option>
              </select>
            )}
          </div>
          <div className="divider-accent mt-1" />
        </header>

        {/* AI Synopsis (if available) — shown before narrative */}
        {synopsisBullets && synopsisBullets.length > 0 && (
          <div className="rounded-lg border border-blue-500/15 bg-blue-500/[0.04] p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span className="font-mono text-micro uppercase tracking-wider text-blue-400">AI Synopsis</span>
            </div>
            <ul className="space-y-1.5 pl-4">
              {synopsisBullets.map((bullet, i) => (
                <li key={i} className="list-disc text-caption leading-relaxed text-zinc-200">
                  {formatBriefText(bullet)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reporter note */}
        {reporterNote && (
          <div className="rounded-lg border border-yellow-500/15 bg-yellow-500/[0.04] px-3 py-2 text-caption text-yellow-200">
            <span className="font-mono text-micro font-medium uppercase tracking-wider text-yellow-500/80 mr-1.5">Note:</span>
            {renderWithReadRequestHighlight(reporterNote)}
          </div>
        )}

        {/* Witness Narrative — larger, narrative-first */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span className="font-mono text-micro uppercase tracking-wider text-zinc-500">Witness Narrative</span>
          </div>
          <div className="space-y-3 break-words text-sm leading-[1.7] text-zinc-100 sm:text-[13px]">
            {(narrative || "No narrative available.").split(/\n\n+/).map((para, i) => (
              <p key={i}>
                {hasReadRequest(para) ? renderWithReadRequestHighlight(para) : para}
              </p>
            ))}
          </div>
        </div>

        {/* Story Score Breakdown */}
        <StoryScoreBreakdown
          storyScore={caseItem.story_score}
          breakdown={caseItem.score_breakdown}
        />

        {caseItem.context && (
          <CollapsibleSection title="Environmental Context" defaultOpen>
            <ContextPanel context={caseItem.context} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Evidence" badge={caseItem.evidence_count ?? 0} defaultOpen={!!caseItem.evidence_count}>
          <EvidencePanel caseItem={caseItem} onAddEvidence={onAddEvidence} />
        </CollapsibleSection>

        <CollapsibleSection title="AI Brief" defaultOpen={!!brief}>
          <BriefTabs caseItem={caseItem} versions={briefVersions} onSignalClick={onSignalClick} />
        </CollapsibleSection>

        <CollapsibleSection title="Brief History" badge={briefVersions?.length ?? 0}>
          <BriefVersionTimeline
            versions={briefVersions}
            onGenerate={onGenerateBrief}
            onCompare={onCompareBriefs}
            onReportIssue={onReportBriefIssue}
          />
        </CollapsibleSection>
      </m.div>

      <BriefDiffModal diff={briefDiff} onClose={onCloseBriefDiff} />
    </>
  );
}
