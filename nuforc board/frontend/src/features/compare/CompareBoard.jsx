import CohortBuilder from "./CohortBuilder";
import CohortMetricsGrid from "./CohortMetricsGrid";

export default function CompareBoard({ options, compare, result, loading, guard, onChange, onRun }) {
  return (
    <section className="space-y-3">
      <CohortBuilder compare={compare} options={options} onChange={onChange} />
      <div className="flex items-center justify-between gap-2">
        {guard ? <p className="text-xs text-amber-200">{guard}</p> : <span />}
        <button
          type="button"
          disabled={Boolean(guard) || loading}
          onClick={onRun}
          className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-45"
        >
          {loading ? "Comparing..." : "Run compare"}
        </button>
      </div>
      <CohortMetricsGrid result={result} loading={loading} />
    </section>
  );
}
