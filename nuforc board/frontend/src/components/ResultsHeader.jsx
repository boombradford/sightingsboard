import { m } from "motion/react";
import { sectionVariants } from "../lib/motion";
import { formatMeta } from "../lib/sighting";

export default function ResultsHeader({ meta }) {
  return (
    <m.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.08 }}
      className="glass-card grid gap-2 p-5 sm:grid-cols-[auto_1fr] sm:items-end"
    >
      <h2 className="font-display text-4xl leading-none text-slate-50">Sighting Log</h2>
      <p className="font-mono text-xs text-slate-400 sm:text-right" aria-live="polite">
        {formatMeta(meta)}
      </p>
    </m.div>
  );
}
