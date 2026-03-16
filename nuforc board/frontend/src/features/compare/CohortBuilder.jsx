const DIMENSIONS = [
  { key: "shape", label: "Shape" },
  { key: "place", label: "Place" },
  { key: "date-range", label: "Date Range" },
];

export default function CohortBuilder({ compare, options, onChange }) {
  const valueOptions =
    compare.dimension === "place"
      ? options.states || []
      : compare.dimension === "shape"
        ? options.shapes || []
        : [];

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <h3 className="font-display text-caption font-semibold text-zinc-200">Define Cohorts</h3>
      </div>

      <div className="grid gap-3 bg-zinc-950/50 p-4 md:grid-cols-3">
        <label className="block">
          <span className="form-label">Dimension</span>
          <select
            value={compare.dimension}
            onChange={(e) => onChange({ dimension: e.target.value, cohortA: "", cohortB: "" })}
            className="input-base select-styled"
          >
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>

        {compare.dimension === "date-range" ? (
          <>
            <label className="block">
              <span className="form-label">Cohort A from</span>
              <input type="date" value={compare.cohortA} onChange={(e) => onChange({ cohortA: e.target.value })} className="input-base" />
            </label>
            <label className="block">
              <span className="form-label">Cohort B to</span>
              <input type="date" value={compare.cohortB} onChange={(e) => onChange({ cohortB: e.target.value })} className="input-base" />
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="form-label">Cohort A</span>
              <select value={compare.cohortA} onChange={(e) => onChange({ cohortA: e.target.value })} className="input-base select-styled">
                <option value="">Select A...</option>
                {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="form-label">Cohort B</span>
              <select value={compare.cohortB} onChange={(e) => onChange({ cohortB: e.target.value })} className="input-base select-styled">
                <option value="">Select B...</option>
                {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </>
        )}
      </div>
    </section>
  );
}
