const GROUPS = [
  { key: "none", label: "None" },
  { key: "shape", label: "Shape" },
  { key: "state", label: "State" },
  { key: "decade", label: "Decade" },
  { key: "explainable", label: "Explanation" },
];

export default function GroupByControl({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-caption text-slate-400">
      Group by
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/[0.08] bg-surface-elevated px-2 py-1.5 text-caption text-slate-200"
      >
        {GROUPS.map((g) => (
          <option key={g.key} value={g.key}>{g.label}</option>
        ))}
      </select>
    </label>
  );
}
