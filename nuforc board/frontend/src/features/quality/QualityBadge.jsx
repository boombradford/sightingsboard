import { m } from "motion/react";
import { springs } from "../../lib/motion";

const VARIANTS = {
  low: "border-rose-500/20 bg-rose-500/10 text-rose-400",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  high: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
};

export default function QualityBadge({ label, score }) {
  const key = String(label || "low").toLowerCase();
  const style = VARIANTS[key] || VARIANTS.low;

  return (
    <m.span
      layout
      title="Data richness score"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.bouncy}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-micro font-medium ${style}`}
    >
      <span className="capitalize">{key}</span>
      <span className="font-mono text-[9px] opacity-70">{score ?? 0}/6</span>
    </m.span>
  );
}
