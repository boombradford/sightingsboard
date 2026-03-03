import CohortSampleList from "./CohortSampleList";

function prettySignal(signal) {
  return String(signal || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CohortMetricsGrid({ result, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-300">Loading cohort comparison...</p>;
  }

  const cohorts = Array.isArray(result?.cohorts) ? result.cohorts : [];
  if (!cohorts.length) {
    return <p className="text-sm text-slate-400">No compare results yet.</p>;
  }

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {cohorts.map((cohort) => (
        <article key={cohort.id} className="glass-card space-y-3 p-4">
          <header className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-cyan-100">{cohort.label}</h3>
            <p className="text-xs font-mono text-slate-300">{cohort.total} cases</p>
          </header>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-500/35 bg-slate-900/70 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Total</p>
              <p className="text-lg font-semibold text-slate-100">{cohort.total}</p>
            </div>
            <div className="rounded-lg border border-slate-500/35 bg-slate-900/70 p-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Geocoded</p>
              <p className="text-lg font-semibold text-slate-100">{cohort.geocoded_pct}%</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Top signals</p>
            <ul className="grid gap-1 text-xs text-slate-200">
              {(cohort.top_signals || []).slice(0, 5).map((signal) => (
                <li key={`${cohort.id}-${signal.key}`} className="flex justify-between rounded-md border border-slate-500/20 bg-slate-900/50 px-2 py-1">
                  <span>{prettySignal(signal.key)}</span>
                  <span>{signal.pct}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">Sampled cases</p>
            <CohortSampleList cases={cohort.sampled_cases} />
          </div>
        </article>
      ))}

      {result?.baseline ? (
        <article className="glass-card p-4 lg:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Baseline</p>
          <p className="text-xl font-semibold text-slate-100">{result.baseline.total} cases in active slice</p>
        </article>
      ) : null}
    </section>
  );
}
