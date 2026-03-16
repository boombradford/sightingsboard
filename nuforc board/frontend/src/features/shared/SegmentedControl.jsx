import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function SegmentedControl({ options, value, onChange, layoutId = "segment" }) {
  return (
    <div className="relative inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative z-10 rounded px-3 py-1.5 text-caption font-medium transition-colors ${
              isActive ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {isActive && (
              <m.div
                className="absolute inset-0 rounded bg-amber-500"
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
