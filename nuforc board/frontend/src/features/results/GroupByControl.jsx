const GROUPS = [
  { key: "none", label: "None" },
  { key: "shape", label: "Shape" },
  { key: "state", label: "State" },
  { key: "decade", label: "Decade" },
  { key: "explainable", label: "Explanation" },
];

export default function GroupByControl({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-caption text-zinc-300">
      <span className="font-mono text-micro uppercase tracking-wider text-zinc-500">Group</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base select-styled"
        style={{ width: "auto" }}
      >
        {GROUPS.map((g) => (
          <option key={g.key} value={g.key}>{g.label}</option>
        ))}
      </select>
    </label>
  );
}
