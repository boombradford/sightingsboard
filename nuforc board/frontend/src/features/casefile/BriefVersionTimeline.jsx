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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-caption font-semibold text-zinc-200">Versions</h3>
        <m.button
          type="button"
          disabled={busy}
          whileTap={{ scale: 0.97, transition: springs.snappy }}
          onClick={async () => {
            setBusy(true);
            try { await onGenerate(); } finally { setBusy(false); }
          }}
          className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1 text-micro font-medium text-amber-400 disabled:opacity-40"
        >
          {busy ? "Generating..." : "Regenerate"}
        </m.button>
      </div>

      {Array.isArray(versions) && versions.length ? (
        <div className="relative pl-4">
          <div
            className="absolute left-1.5 top-1 bottom-1 w-px"
            style={{ background: "linear-gradient(to bottom, rgba(245,158,11,0.3), rgba(255,255,255,0.04) 40%, transparent)" }}
          />
          <ul className="space-y-1">
            {versions.map((v, i) => {
              const isLatest = i === 0;
              return (
                <m.li
                  key={v.brief_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springs.smooth, delay: stagger(i) }}
                  className="relative flex items-center gap-2 py-1 text-caption text-zinc-300"
                >
                  {isLatest ? (
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2">
                      <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-500 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </div>
                  ) : (
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full border border-zinc-700 bg-zinc-900" />
                  )}
                  <span className="font-mono text-micro">{isLatest ? <span className="text-amber-400">v{v.version_num}</span> : `v${v.version_num}`}</span>
                  <span className="font-mono text-micro text-zinc-500">{v.generated_at}</span>
                  {v.model_label && <span className="text-micro text-zinc-600">{v.model_label}</span>}
                </m.li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-caption text-zinc-500">No versions yet.</p>
      )}

      {/* Compare versions */}
      <div className="grid gap-2 grid-cols-2">
        <label className="block">
          <span className="form-label">Left</span>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} className="input-base select-styled">
            <option value="">Select</option>
            {(versions || []).map((v) => <option key={`l-${v.brief_id}`} value={v.brief_id}>v{v.version_num}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="form-label">Right</span>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} className="input-base select-styled">
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
        <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3 space-y-2">
          <p className="form-label">Report issue</p>
          <select value={issueReason} onChange={(e) => setIssueReason(e.target.value)} className="input-base select-styled">
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
            className="input-base"
          />
          <m.button
            type="button"
            whileTap={{ scale: 0.97, transition: springs.snappy }}
            onClick={async () => {
              await onReportIssue(latest.brief_id, issueReason, issueNotes);
              setIssueNotes("");
            }}
            className="btn-danger"
          >
            Report issue
          </m.button>
        </div>
      )}
    </section>
  );
}
