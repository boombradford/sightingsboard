import { m } from "framer-motion";

export default function CompareSwitch({ mode, includeBaseline, onModeChange, onBaselineChange }) {
  return (
    <section className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="inline-flex rounded-full border border-slate-500/35 bg-slate-900/80 p-1">
        {[
          { key: "explore", label: "Explore" },
          { key: "compare", label: "Compare" },
        ].map((option) => {
          const active = mode === option.key;
          return (
            <m.button
              key={option.key}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onModeChange(option.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                active ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
              }`}
            >
              {option.label}
            </m.button>
          );
        })}
      </div>

      <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(includeBaseline)}
          onChange={(event) => onBaselineChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-500 bg-slate-900"
        />
        Include baseline
      </label>
    </section>
  );
}
