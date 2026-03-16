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
  if (!cohorts.length) return <p className="text-caption text-zinc-500">No compare results yet.</p>;

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {cohorts.map((cohort, ci) => (
        <m.article
          key={cohort.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.smooth, delay: stagger(ci) }}
          className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
        >
          <header className="flex items-center justify-between gap-2">
            <h3 className="font-display text-body font-semibold text-zinc-100">{cohort.label}</h3>
            <span className="font-mono text-caption text-zinc-400">{cohort.total} cases</span>
          </header>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-zinc-800/50 p-2.5">
              <p className="font-mono text-micro uppercase tracking-wider text-zinc-500">Total</p>
              <CountUpNumber value={cohort.total} className="font-display text-heading font-semibold text-zinc-100" />
            </div>
            <div className="rounded-md bg-zinc-800/50 p-2.5">
              <p className="font-mono text-micro uppercase tracking-wider text-zinc-500">Geocoded</p>
              <p className="font-display text-heading font-semibold text-amber-400">{cohort.geocoded_pct}%</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-micro uppercase tracking-wider text-zinc-500">Top signals</p>
            <ul className="space-y-1">
              {(cohort.top_signals || []).slice(0, 5).map((signal) => (
                <li
                  key={`${cohort.id}-${signal.key}`}
                  className="relative flex items-center justify-between overflow-hidden rounded-md bg-zinc-800/40 px-2.5 py-1.5 text-caption text-zinc-200"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500/[0.06]"
                    style={{ width: `${signal.pct}%` }}
                  />
                  <span className="relative">{prettySignal(signal.key)}</span>
                  <span className="relative font-mono text-micro text-amber-400">{signal.pct}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-micro uppercase tracking-wider text-zinc-500">Sampled cases</p>
            <CohortSampleList cases={cohort.sampled_cases} />
          </div>
        </m.article>
      ))}

      {result?.baseline && (
        <m.article
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.smooth}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 lg:col-span-2"
        >
          <p className="font-mono text-micro uppercase tracking-wider text-zinc-500">Baseline</p>
          <p className="font-display text-heading font-semibold text-zinc-100">
            <CountUpNumber value={result.baseline.total} className="font-display text-heading font-semibold text-zinc-100" /> cases in active slice
          </p>
        </m.article>
      )}
    </section>
  );
}
