import { useState } from "react";
import AddEvidenceModal from "./AddEvidenceModal";

function stanceStyle(stance) {
  if (stance === "supports") return "border-emerald-300/45 bg-emerald-500/10 text-emerald-100";
  if (stance === "contradicts") return "border-rose-300/45 bg-rose-500/10 text-rose-100";
  return "border-slate-400/45 bg-slate-500/10 text-slate-100";
}

export default function EvidencePanel({ caseItem, onAddEvidence }) {
  const [open, setOpen] = useState(false);
  const evidence = Array.isArray(caseItem?.evidence) ? caseItem.evidence : [];

  return (
    <section className="glass-card space-y-3 p-3">
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Evidence</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100"
        >
          Add enrichment
        </button>
      </header>

      {!evidence.length ? (
        <div className="rounded-lg border border-slate-500/30 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Evidence: None yet. Link a source with stance and match factors.
        </div>
      ) : (
        <ul className="grid gap-2">
          {evidence.map((item) => (
            <li key={item.evidence_id} className="rounded-xl border border-slate-500/35 bg-slate-950/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-100">{item.source_title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${stanceStyle(item.stance)}`}>
                  {item.stance}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] font-mono text-slate-400">{item.domain || "unknown-domain"}</p>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                {item.match_time ? <span className="chip">time</span> : null}
                {item.match_location ? <span className="chip">location</span> : null}
                {item.match_visual ? <span className="chip">visual</span> : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-200">{item.notes}</p>
              {item.excerpt ? <blockquote className="mt-2 border-l-2 border-slate-500/35 pl-2 text-xs text-slate-300">{item.excerpt}</blockquote> : null}
              {item.source_url ? (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs text-cyan-200 underline-offset-2 hover:underline"
                >
                  Open source
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AddEvidenceModal open={open} caseItem={caseItem} onClose={() => setOpen(false)} onSubmit={onAddEvidence} />
    </section>
  );
}
