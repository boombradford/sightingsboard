const DIMENSIONS = [
  { key: "shape", label: "Shape" },
  { key: "place", label: "Place" },
  { key: "date-range", label: "Date Range" },
];

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200";

export default function CohortBuilder({ compare, options, onChange }) {
  const valueOptions =
    compare.dimension === "place"
      ? options.states || []
      : compare.dimension === "shape"
        ? options.shapes || []
        : [];

  return (
    <section className="surface-card grid gap-3 p-4 md:grid-cols-3">
      <label className="block">
        <span className="text-micro text-slate-500">Dimension</span>
        <select
          value={compare.dimension}
          onChange={(e) => onChange({ dimension: e.target.value, cohortA: "", cohortB: "" })}
          className={inputCls}
        >
          {DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      </label>

      {compare.dimension === "date-range" ? (
        <>
          <label className="block">
            <span className="text-micro text-slate-500">Cohort A from</span>
            <input type="date" value={compare.cohortA} onChange={(e) => onChange({ cohortA: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-micro text-slate-500">Cohort B to</span>
            <input type="date" value={compare.cohortB} onChange={(e) => onChange({ cohortB: e.target.value })} className={inputCls} />
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-micro text-slate-500">Cohort A</span>
            <select value={compare.cohortA} onChange={(e) => onChange({ cohortA: e.target.value })} className={inputCls}>
              <option value="">Select A...</option>
              {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-micro text-slate-500">Cohort B</span>
            <select value={compare.cohortB} onChange={(e) => onChange({ cohortB: e.target.value })} className={inputCls}>
              <option value="">Select B...</option>
              {valueOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
