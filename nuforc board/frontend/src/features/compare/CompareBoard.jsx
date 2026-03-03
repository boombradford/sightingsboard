import { m } from "motion/react";
import { springs } from "../../lib/motion";
import CohortBuilder from "./CohortBuilder";
import CohortMetricsGrid from "./CohortMetricsGrid";

export default function CompareBoard({ options, compare, result, loading, guard, onChange, onRun }) {
  return (
    <section className="space-y-4">
      <CohortBuilder compare={compare} options={options} onChange={onChange} />
      <div className="flex items-center justify-between gap-2">
        {guard ? <p className="text-caption text-amber-400">{guard}</p> : <span />}
        <m.button
          type="button"
          disabled={Boolean(guard) || loading}
          onClick={onRun}
          whileTap={{ scale: 0.96, transition: springs.snappy }}
          className="btn-primary disabled:opacity-30"
        >
          {loading ? "Comparing..." : "Run compare"}
        </m.button>
      </div>
      <CohortMetricsGrid result={result} loading={loading} />
    </section>
  );
}
