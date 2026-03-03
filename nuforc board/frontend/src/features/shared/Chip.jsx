import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function Chip({ selected, onClick, children, className = "" }) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-caption font-medium transition-colors ${
        selected
          ? "border-accent/30 bg-accent-muted text-accent"
          : "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/[0.10] hover:text-slate-200"
      } ${className}`}
      whileTap={{ scale: 0.95, transition: springs.snappy }}
      animate={selected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={springs.bouncy}
    >
      {children}
    </m.button>
  );
}
