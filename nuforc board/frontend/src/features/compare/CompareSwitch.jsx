import { m } from "motion/react";
import { springs } from "../../lib/motion";

const MODES = [
  { key: "explore", label: "Explore" },
  { key: "compare", label: "Compare" },
];

export default function CompareSwitch({ mode, includeBaseline, onModeChange, onBaselineChange }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {MODES.map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onModeChange(opt.key)}
              className={`relative z-10 rounded px-3 py-1.5 text-caption font-medium transition-colors ${
                active ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {active && (
                <m.div
                  className="absolute inset-0 rounded bg-amber-500"
                  layoutId="mode-pill"
                  transition={springs.snappy}
                />
              )}
              <span className="relative">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <label className="inline-flex items-center gap-2 text-caption text-zinc-300">
        <input
          type="checkbox"
          checked={Boolean(includeBaseline)}
          onChange={(e) => onBaselineChange(e.target.checked)}
          className="checkbox-accent"
        />
        Baseline
      </label>
    </div>
  );
}
