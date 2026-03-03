import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";

function prettySignal(signal) {
  return String(signal || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PatternStrip({ signals, activeSignal, onToggleSignal }) {
  const items = Array.isArray(signals) ? signals.slice(0, 5) : [];
  if (!items.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      <span className="shrink-0 text-micro text-slate-500">Patterns</span>
      {items.map((signal, i) => {
        const active = activeSignal === signal.key;
        return (
          <m.button
            key={signal.key}
            type="button"
            onClick={() => onToggleSignal(signal.key)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springs.bouncy, delay: stagger(i) }}
            whileTap={{ scale: 0.95, transition: springs.snappy }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-caption font-medium transition-colors ${
              active
                ? "border-accent/30 bg-accent-muted text-accent"
                : "border-white/[0.06] bg-white/[0.03] text-slate-400 hover:border-white/[0.10] hover:text-slate-200"
            }`}
          >
            <span>{prettySignal(signal.key)}</span>
            <span className={`text-micro ${active ? "text-accent/70" : "text-slate-600"}`}>{signal.pct}%</span>
          </m.button>
        );
      })}
    </div>
  );
}
