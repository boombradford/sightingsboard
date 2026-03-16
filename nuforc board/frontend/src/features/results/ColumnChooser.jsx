import Chip from "../shared/Chip";

const COLUMNS = [
  ["date_time", "Date"],
  ["location", "Location"],
  ["shape", "Shape"],
  ["duration", "Duration"],
  ["observers", "Observers"],
  ["quality", "Quality"],
  ["evidence", "Evidence"],
  ["signals", "Signals"],
  ["score", "Score"],
];

export default function ColumnChooser({ columns, onToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-micro uppercase tracking-wider text-zinc-500">Columns</span>
      {COLUMNS.map(([key, label]) => (
        <Chip key={key} selected={columns.includes(key)} onClick={() => onToggle(key)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}
