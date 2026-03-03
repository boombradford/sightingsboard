import { m } from "framer-motion";
import QualityBadge from "../quality/QualityBadge";
import { rowTransition } from "../../lib/iosMotion";

function shortSignals(signals) {
  if (!Array.isArray(signals) || !signals.length) return "-";
  return signals.slice(0, 3).join(", ");
}

function renderCell(item, column) {
  if (column === "date_time") return item.date_time || "-";
  if (column === "location") return `${item.city || "unknown-city"}, ${item.state || "--"}`;
  if (column === "shape") return item.shape || "unknown";
  if (column === "duration") return item.duration || "unknown";
  if (column === "observers") return item.observer_count ?? "n/a";
  if (column === "evidence") return item.evidence_count ?? item.enrichment_count ?? 0;
  if (column === "signals") return shortSignals(item.signals);
  return null;
}

function columnTitle(column) {
  const map = {
    date_time: "Date",
    location: "Location",
    shape: "Shape",
    duration: "Duration",
    observers: "Observers",
    quality: "Quality",
    evidence: "Evidence",
    signals: "Signals",
  };
  return map[column] || column;
}

export default function SightingTable({ groups, columns, selectedCaseId, onSelectCase, loading }) {
  if (loading) {
    return <p className="text-sm text-slate-300">Loading sightings...</p>;
  }
  if (!Array.isArray(groups) || !groups.length) {
    return <p className="text-sm text-slate-400">No sightings in this slice.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="glass-card overflow-hidden">
          <header className="border-b border-slate-500/25 bg-slate-900/60 px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
              {group.key} <span className="text-slate-400">({group.items.length})</span>
            </h3>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-500/20 bg-slate-900/40 text-slate-400">
                  {columns.map((column) => (
                    <th key={`${group.key}-${column}`} className="px-3 py-2 font-medium uppercase tracking-[0.12em]">
                      {columnTitle(column)}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium uppercase tracking-[0.12em]">Action</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => {
                  const active = selectedCaseId === item.sighting_id;
                  return (
                    <m.tr
                      key={item.sighting_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={rowTransition(index)}
                      className={`border-b border-slate-500/15 ${active ? "bg-cyan-500/8" : "hover:bg-slate-900/35"}`}
                    >
                      {columns.map((column) => (
                        <td key={`${item.sighting_id}-${column}`} className="px-3 py-2 align-top text-slate-100">
                          {column === "quality" ? (
                            <QualityBadge label={item.quality_label} score={item.quality_score} />
                          ) : (
                            renderCell(item, column)
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() => onSelectCase(item.sighting_id)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                            active
                              ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                              : "border-slate-500/40 bg-slate-900/70 text-slate-200"
                          }`}
                        >
                          Open case file
                        </button>
                      </td>
                    </m.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
