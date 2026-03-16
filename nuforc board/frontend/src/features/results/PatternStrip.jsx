import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";

const SIGNAL_LABELS = {
  lights_on_object: "Lights on Object",
  no_sound: "No Sound",
  hover: "Hover",
  formation: "Formation",
  aircraft_nearby: "Aircraft Nearby",
  color_white: "Color: White",
  fast_acceleration: "Fast Acceleration",
  camera_mismatch: "Camera Mismatch",
  abduction: "Abduction",
  lost_time: "Lost Time",
  entity: "Entity / Humanoid",
  paralysis: "Paralysis",
  telepathy: "Telepathy",
  physical_effects: "Physical Effects",
  em_effects: "EM Effects",
  fireball_match: "Fireball Match",
};

function prettySignal(signal) {
  return SIGNAL_LABELS[signal] || String(signal || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PatternStrip({ signals, activeSignal, onToggleSignal }) {
  const items = Array.isArray(signals) ? signals.slice(0, 5) : [];
  if (!items.length) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1">
      <span className="shrink-0 font-mono text-micro uppercase tracking-wider text-zinc-500">Patterns</span>
      {items.map((signal, i) => {
        const active = activeSignal === signal.key;
        return (
          <m.button
            key={signal.key}
            type="button"
            onClick={() => onToggleSignal(signal.key)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springs.smooth, delay: stagger(i) }}
            whileTap={{ scale: 0.96, transition: springs.snappy }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${
              active
                ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            <span>{prettySignal(signal.key)}</span>
            <span className={`font-mono text-micro ${active ? "text-amber-500/70" : "text-zinc-500"}`}>{signal.pct}%</span>
          </m.button>
        );
      })}
    </div>
  );
}
