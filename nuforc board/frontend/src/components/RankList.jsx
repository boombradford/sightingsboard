import { formatNumber, safeText } from "../lib/format";

export default function RankList({ rows, labelKey }) {
  const topCount = Number(rows?.[0]?.count || 1);

  return (
    <ul className="grid gap-2">
      {(rows ?? []).map((row) => {
        const pct = Math.max(5, Math.round((Number(row.count || 0) / topCount) * 100));
        return (
          <li
            key={`${labelKey}-${row[labelKey]}`}
            className="relative grid grid-cols-[1fr_auto] items-center overflow-hidden rounded-xl border border-slate-500/35 bg-slate-900/75 px-2 py-1.5"
          >
            <span
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400/25 to-sky-400/25"
              style={{ width: `${pct}%` }}
            />
            <span className="relative z-10 truncate font-mono text-[11px] text-slate-100">
              {safeText(row[labelKey], "unknown")}
            </span>
            <span className="relative z-10 font-mono text-[11px] text-emerald-300">
              {formatNumber(row.count)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
