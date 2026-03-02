export default function SourceLegendPanel() {
  return (
    <section className="glass-card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Source Legend</h2>
        <p className="text-sm text-slate-400">How enrichment stances are interpreted.</p>
      </div>
      <ul className="grid gap-2 pl-5 text-sm text-slate-300">
        <li>
          <strong className="text-slate-100">Supports:</strong> external source aligns with witness report details.
        </li>
        <li>
          <strong className="text-slate-100">Contradicts:</strong> source suggests a likely conventional explanation.
        </li>
        <li>
          <strong className="text-slate-100">Contextual:</strong> source adds timeline/location context but not direct proof.
        </li>
      </ul>
    </section>
  );
}
