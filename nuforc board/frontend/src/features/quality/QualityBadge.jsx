import { m } from "framer-motion";

const STYLE_MAP = {
  low: "border-rose-300/40 bg-rose-500/10 text-rose-100",
  medium: "border-amber-300/45 bg-amber-500/10 text-amber-100",
  high: "border-emerald-300/45 bg-emerald-500/10 text-emerald-100",
};

export default function QualityBadge({ label, score }) {
  const normalized = String(label || "low").toLowerCase();
  const style = STYLE_MAP[normalized] || STYLE_MAP.low;
  const title =
    "Data richness score based on coordinates, duration, structured fields, witnesses, evidence, and media markers.";

  return (
    <m.span
      layout
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${style}`}
    >
      <span>{normalized} richness</span>
      <span className="font-mono text-[10px] text-slate-200/90">{score ?? 0}/6</span>
    </m.span>
  );
}
