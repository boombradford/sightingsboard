import { m } from "motion/react";
import { springs } from "../../lib/motion";

const MODES = [
  { key: "explore", label: "Explore" },
  { key: "compare", label: "Compare" },
];

export default function CompareSwitch({ mode, includeBaseline, onModeChange, onBaselineChange }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
        {MODES.map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onModeChange(opt.key)}
              className={`relative z-10 rounded-md px-3 py-1.5 text-caption font-medium transition-colors ${
                active ? "text-surface-deepest" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {active && (
                <m.div
                  className="absolute inset-0 rounded-md bg-accent"
                  layoutId="mode-pill"
                  transition={springs.snappy}
                />
              )}
              <span className="relative">{opt.label}</span>
            </button>
          );
        })}
      </div>

      <label className="inline-flex items-center gap-2 text-caption text-slate-400">
        <input
          type="checkbox"
          checked={Boolean(includeBaseline)}
          onChange={(e) => onBaselineChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-white/[0.15] bg-surface-card accent-accent"
        />
        Baseline
      </label>
    </div>
  );
}
