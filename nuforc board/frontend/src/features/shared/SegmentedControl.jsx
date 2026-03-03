import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function SegmentedControl({ options, value, onChange, layoutId = "segment" }) {
  return (
    <div className="relative inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative z-10 rounded-md px-3 py-1.5 text-caption font-medium transition-colors ${
              isActive ? "text-surface-deepest" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {isActive && (
              <m.div
                className="absolute inset-0 rounded-md bg-accent"
                layoutId={layoutId}
                transition={springs.snappy}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
