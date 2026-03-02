import { m } from "framer-motion";
import { sectionVariants } from "../lib/animations";
import { formatMeta } from "../lib/sighting";

export default function ResultsHeader({ meta }) {
  return (
    <m.div
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.08 }}
      className="glass-card flex flex-wrap items-end justify-between gap-3 p-4"
    >
      <h2 className="font-display text-4xl leading-none text-slate-50">Sighting Log</h2>
      <p className="font-mono text-xs text-slate-400" aria-live="polite">
        {formatMeta(meta)}
      </p>
    </m.div>
  );
}
