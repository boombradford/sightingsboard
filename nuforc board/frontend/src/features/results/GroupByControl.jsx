const GROUPS = [
  { key: "none", label: "None" },
  { key: "shape", label: "Shape" },
  { key: "state", label: "State" },
  { key: "decade", label: "Decade" },
  { key: "explainable", label: "Explanation" },
];

export default function GroupByControl({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-slate-300">
      Group by
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100"
      >
        {GROUPS.map((group) => (
          <option key={group.key} value={group.key}>
            {group.label}
          </option>
        ))}
      </select>
    </label>
  );
}
