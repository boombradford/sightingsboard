import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";

export default function BriefVersionTimeline({ versions, onGenerate, onCompare, onReportIssue }) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [issueReason, setIssueReason] = useState("hallucination");
  const [issueNotes, setIssueNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useMemo(() => (Array.isArray(versions) && versions.length ? versions[0] : null), [versions]);

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-1.5 text-caption text-slate-200";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-caption font-semibold text-slate-200">Versions</h3>
        <m.button
          type="button"
          disabled={busy}
          whileTap={{ scale: 0.96, transition: springs.snappy }}
          onClick={async () => {
            setBusy(true);
            try { await onGenerate(); } finally { setBusy(false); }
          }}
          className="rounded-lg border border-accent/20 bg-accent-muted px-2.5 py-1 text-micro font-medium text-accent disabled:opacity-40"
        >
          {busy ? "Generating..." : "Regenerate"}
        </m.button>
      </div>

      {Array.isArray(versions) && versions.length ? (
        <div className="relative pl-4">
          {/* Timeline line */}
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/[0.06]" />
          <ul className="space-y-1">
            {versions.map((v, i) => (
              <m.li
                key={v.brief_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springs.smooth, delay: stagger(i) }}
                className="relative flex items-center gap-2 py-1 text-caption text-slate-400"
              >
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border border-white/[0.12] bg-surface-card" />
                <span className="font-mono text-micro">v{v.version_num}</span>
                <span className="text-micro text-slate-600">{v.generated_at}</span>
                {v.model_label && <span className="text-micro text-slate-600">{v.model_label}</span>}
              </m.li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-slate-500">No versions yet.</p>
      )}

      {/* Compare versions */}
      <div className="grid gap-2 grid-cols-2">
        <label className="block">
          <span className="text-micro text-slate-500">Left</span>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {(versions || []).map((v) => <option key={`l-${v.brief_id}`} value={v.brief_id}>v{v.version_num}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-slate-500">Right</span>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {(versions || []).map((v) => <option key={`r-${v.brief_id}`} value={v.brief_id}>v{v.version_num}</option>)}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={!leftId || !rightId}
        onClick={() => onCompare(Number(leftId), Number(rightId))}
        className="btn-crystal w-full justify-center disabled:opacity-30"
      >
        Compare versions
      </button>

      {/* Report issue */}
      {latest && (
        <div className="rounded-lg border border-white/[0.04] bg-surface-deepest/40 p-3 space-y-2">
          <p className="text-micro font-medium text-slate-500">Report issue</p>
          <select value={issueReason} onChange={(e) => setIssueReason(e.target.value)} className={inputCls}>
            <option value="hallucination">Hallucination</option>
            <option value="citation_mismatch">Citation mismatch</option>
            <option value="missing_context">Missing context</option>
            <option value="other">Other</option>
          </select>
          <textarea
            rows={2}
            value={issueNotes}
            onChange={(e) => setIssueNotes(e.target.value)}
            placeholder="Optional notes"
            className={inputCls}
          />
          <m.button
            type="button"
            whileTap={{ scale: 0.96, transition: springs.snappy }}
            onClick={async () => {
              await onReportIssue(latest.brief_id, issueReason, issueNotes);
              setIssueNotes("");
            }}
            className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1.5 text-micro font-medium text-rose-400 transition hover:border-rose-500/30"
          >
            Report issue
          </m.button>
        </div>
      )}
    </section>
  );
}
