import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function Chip({ selected, onClick, children, className = "" }) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${
        selected
          ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
          : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200"
      } ${className}`}
      whileTap={{ scale: 0.96, transition: springs.snappy }}
    >
      {children}
    </m.button>
  );
}
