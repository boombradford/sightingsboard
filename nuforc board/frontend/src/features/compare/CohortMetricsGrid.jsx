import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";
import CountUpNumber from "../shared/CountUpNumber";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import CohortSampleList from "./CohortSampleList";

function prettySignal(signal) {
  return String(signal || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CohortMetricsGrid({ result, loading }) {
  if (loading) return <LoadingSkeleton rows={4} columns={2} />;

  const cohorts = Array.isArray(result?.cohorts) ? result.cohorts : [];
  if (!cohorts.length) return <p className="text-caption text-slate-500">No compare results yet.</p>;

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {cohorts.map((cohort, ci) => (
        <m.article
          key={cohort.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.smooth, delay: stagger(ci) }}
          className="surface-card space-y-3 p-4"
        >
          <header className="flex items-center justify-between gap-2">
            <h3 className="text-body font-semibold text-slate-100">{cohort.label}</h3>
            <span className="text-caption font-mono text-slate-500">{cohort.total} cases</span>
          </header>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-white/[0.04] bg-surface-deepest/40 p-2.5">
              <p className="text-micro text-slate-500">Total</p>
              <CountUpNumber value={cohort.total} className="text-heading font-semibold text-slate-100" />
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-surface-deepest/40 p-2.5">
              <p className="text-micro text-slate-500">Geocoded</p>
              <p className="text-heading font-semibold text-accent">{cohort.geocoded_pct}%</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-micro font-medium text-slate-500">Top signals</p>
            <ul className="space-y-1">
              {(cohort.top_signals || []).slice(0, 5).map((signal) => (
                <li key={`${cohort.id}-${signal.key}`} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-surface-deepest/30 px-2.5 py-1.5 text-caption text-slate-300">
                  <span>{prettySignal(signal.key)}</span>
                  <span className="text-micro text-slate-500">{signal.pct}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-micro font-medium text-slate-500">Sampled cases</p>
            <CohortSampleList cases={cohort.sampled_cases} />
          </div>
        </m.article>
      ))}

      {result?.baseline && (
        <m.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.smooth}
          className="surface-card p-4 lg:col-span-2"
        >
          <p className="text-micro text-slate-500">Baseline</p>
          <p className="text-heading font-semibold text-slate-100">
            <CountUpNumber value={result.baseline.total} className="text-heading font-semibold text-slate-100" /> cases in active slice
          </p>
        </m.article>
      )}
    </section>
  );
}
