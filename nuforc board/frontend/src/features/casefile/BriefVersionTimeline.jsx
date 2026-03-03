import { useMemo, useState } from "react";

export default function BriefVersionTimeline({ versions, onGenerate, onCompare, onReportIssue }) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [issueReason, setIssueReason] = useState("hallucination");
  const [issueNotes, setIssueNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useMemo(() => (Array.isArray(versions) && versions.length ? versions[0] : null), [versions]);

  return (
    <section className="glass-card space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Brief versions</h3>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onGenerate();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 disabled:opacity-50"
        >
          {busy ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {Array.isArray(versions) && versions.length ? (
        <ul className="grid gap-1.5">
          {versions.map((version) => (
            <li key={version.brief_id} className="rounded-lg border border-slate-500/30 bg-slate-900/65 px-2.5 py-1.5 text-xs text-slate-200">
              v{version.version_num} | {version.generated_at} | {version.model_label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">No brief versions yet.</p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">
          Left
          <select
            value={leftId}
            onChange={(event) => setLeftId(event.target.value)}
            className="rounded-lg border border-slate-500/35 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">Select version</option>
            {(versions || []).map((version) => (
              <option key={`left-${version.brief_id}`} value={version.brief_id}>
                v{version.version_num}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">
          Right
          <select
            value={rightId}
            onChange={(event) => setRightId(event.target.value)}
            className="rounded-lg border border-slate-500/35 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="">Select version</option>
            {(versions || []).map((version) => (
              <option key={`right-${version.brief_id}`} value={version.brief_id}>
                v{version.version_num}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={!leftId || !rightId}
        onClick={() => onCompare(Number(leftId), Number(rightId))}
        className="rounded-full border border-slate-400/45 bg-slate-900/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-200 disabled:opacity-40"
      >
        Compare brief versions
      </button>

      {latest ? (
        <div className="grid gap-1 rounded-lg border border-slate-500/30 bg-slate-900/60 p-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Report issue</p>
          <select
            value={issueReason}
            onChange={(event) => setIssueReason(event.target.value)}
            className="rounded-lg border border-slate-500/35 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="hallucination">Hallucination</option>
            <option value="citation_mismatch">Citation mismatch</option>
            <option value="missing_context">Missing context</option>
            <option value="other">Other</option>
          </select>
          <textarea
            rows={2}
            value={issueNotes}
            onChange={(event) => setIssueNotes(event.target.value)}
            placeholder="Optional notes"
            className="rounded-lg border border-slate-500/35 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={async () => {
              await onReportIssue(latest.brief_id, issueReason, issueNotes);
              setIssueNotes("");
            }}
            className="rounded-full border border-rose-300/55 bg-rose-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-rose-100"
          >
            Report issue
          </button>
        </div>
      ) : null}
    </section>
  );
}
