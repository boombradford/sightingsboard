export default function ActiveSlicePanel({ snapshotLine, queryChips }) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Active Slice</h2>
        <p className="text-sm text-slate-400">Current query profile at a glance.</p>
      </div>
      <p className="text-sm text-slate-200" aria-live="polite">
        {snapshotLine}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {queryChips.map((chip) => (
          <li key={chip} className="chip">
            {chip}
          </li>
        ))}
      </ul>
    </section>
  );
}
