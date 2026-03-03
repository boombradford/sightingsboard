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
    <section className="glass-card grid gap-3 p-3 md:grid-cols-3">
      <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
        Dimension
        <select
          value={compare.dimension}
          onChange={(event) => onChange({ dimension: event.target.value, cohortA: "", cohortB: "" })}
          className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
        >
          {DIMENSIONS.map((dimension) => (
            <option key={dimension.key} value={dimension.key}>
              {dimension.label}
            </option>
          ))}
        </select>
      </label>

      {compare.dimension === "date-range" ? (
        <>
          <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
            Cohort A from
            <input
              type="date"
              value={compare.cohortA}
              onChange={(event) => onChange({ cohortA: event.target.value })}
              className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
            Cohort B to
            <input
              type="date"
              value={compare.cohortB}
              onChange={(event) => onChange({ cohortB: event.target.value })}
              className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
            />
          </label>
        </>
      ) : (
        <>
          <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
            Cohort A
            <select
              value={compare.cohortA}
              onChange={(event) => onChange({ cohortA: event.target.value })}
              className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
            >
              <option value="">Select A...</option>
              {valueOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
            Cohort B
            <select
              value={compare.cohortB}
              onChange={(event) => onChange({ cohortB: event.target.value })}
              className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
            >
              <option value="">Select B...</option>
              {valueOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
