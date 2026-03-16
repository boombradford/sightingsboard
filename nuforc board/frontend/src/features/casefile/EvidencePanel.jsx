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

function stanceBorderColor(stance) {
  if (stance === "supports") return "border-green-500/15";
  if (stance === "contradicts") return "border-red-500/15";
  return "border-zinc-800";
}

function stanceBarColor(stance) {
  if (stance === "supports") return "rgba(34,197,94,0.5)";
  if (stance === "contradicts") return "rgba(239,68,68,0.5)";
  return "rgba(255,255,255,0.08)";
}

export default function EvidencePanel({ caseItem, onAddEvidence }) {
  const [open, setOpen] = useState(false);
  const evidence = Array.isArray(caseItem?.evidence) ? caseItem.evidence : [];

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="font-display text-caption font-semibold text-zinc-200">Evidence</h3>
        <m.button
          type="button"
          onClick={() => setOpen(true)}
          whileTap={{ scale: 0.97, transition: springs.snappy }}
          className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1 text-micro font-medium text-amber-400 transition-colors hover:border-amber-500/30"
        >
          Add enrichment
        </m.button>
      </header>

      {!evidence.length ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-caption text-zinc-500">
          No evidence linked yet.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {evidence.map((item, i) => (
            <m.li
              key={item.evidence_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.smooth, delay: stagger(i) }}
              className={`rounded-md ${stanceBorderColor(item.stance)} border bg-zinc-950/50 p-3`}
              style={{ boxShadow: `inset 3px 0 0 ${stanceBarColor(item.stance)}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-caption font-medium text-zinc-200">{item.source_title}</p>
                <Badge variant={stanceVariant(item.stance)}>{item.stance}</Badge>
              </div>
              <p className="mt-0.5 font-mono text-micro text-zinc-500">{item.domain || "unknown"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {item.match_time && <Badge variant="neutral">time</Badge>}
                {item.match_location && <Badge variant="neutral">location</Badge>}
                {item.match_visual && <Badge variant="neutral">visual</Badge>}
              </div>
              {item.notes && <p className="mt-2 text-caption text-zinc-300">{item.notes}</p>}
              {item.excerpt && (
                <blockquote className="mt-2 border-l-2 border-zinc-700 pl-2.5 text-caption text-zinc-400 italic">
                  {item.excerpt}
                </blockquote>
              )}
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-micro text-amber-400/80 hover:text-amber-400"
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
