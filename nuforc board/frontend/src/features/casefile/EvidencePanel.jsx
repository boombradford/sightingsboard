import { useState } from "react";
import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";
import Badge from "../shared/Badge";
import AddEvidenceModal from "./AddEvidenceModal";

function stanceVariant(stance) {
  if (stance === "supports") return "success";
  if (stance === "contradicts") return "danger";
  return "neutral";
}

export default function EvidencePanel({ caseItem, onAddEvidence }) {
  const [open, setOpen] = useState(false);
  const evidence = Array.isArray(caseItem?.evidence) ? caseItem.evidence : [];

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-caption font-semibold text-slate-200">Evidence</h3>
        <m.button
          type="button"
          onClick={() => setOpen(true)}
          whileTap={{ scale: 0.96, transition: springs.snappy }}
          className="rounded-lg border border-accent/20 bg-accent-muted px-2.5 py-1 text-micro font-medium text-accent transition-colors hover:border-accent/40"
        >
          Add enrichment
        </m.button>
      </header>

      {!evidence.length ? (
        <div className="rounded-lg border border-white/[0.04] bg-surface-deepest/40 px-3 py-2.5 text-caption text-slate-500">
          No evidence linked yet.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {evidence.map((item, i) => (
            <m.li
              key={item.evidence_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.smooth, delay: stagger(i) }}
              className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-caption font-medium text-slate-200">{item.source_title}</p>
                <Badge variant={stanceVariant(item.stance)}>{item.stance}</Badge>
              </div>
              <p className="mt-0.5 text-micro font-mono text-slate-500">{item.domain || "unknown"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.match_time && <Badge variant="neutral">time</Badge>}
                {item.match_location && <Badge variant="neutral">location</Badge>}
                {item.match_visual && <Badge variant="neutral">visual</Badge>}
              </div>
              {item.notes && <p className="mt-2 text-caption text-slate-400">{item.notes}</p>}
              {item.excerpt && (
                <blockquote className="mt-2 border-l-2 border-white/[0.08] pl-2.5 text-caption text-slate-500 italic">
                  {item.excerpt}
                </blockquote>
              )}
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-micro text-accent/80 hover:text-accent"
                >
                  Open source &rarr;
                </a>
              )}
            </m.li>
          ))}
        </ul>
      )}

      <AddEvidenceModal open={open} caseItem={caseItem} onClose={() => setOpen(false)} onSubmit={onAddEvidence} />
    </section>
  );
}
