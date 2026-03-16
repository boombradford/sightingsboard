import { m } from "motion/react";
import { springs } from "../../lib/motion";

const VARIANTS = {
  low: "border-red-500/20 bg-red-500/10 text-red-400",
  medium: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  high: "border-green-500/20 bg-green-500/10 text-green-400",
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
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-micro font-medium ${style}`}
    >
      <span className="capitalize">{key}</span>
      <span className="font-mono text-[9px] opacity-70">{score ?? 0}/6</span>
    </m.span>
  );
}
