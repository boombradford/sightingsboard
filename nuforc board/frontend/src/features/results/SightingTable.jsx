import { m, useReducedMotion } from "motion/react";
import QualityBadge from "../quality/QualityBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import { rowTransition, springs } from "../../lib/motion";

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

const COL_TITLES = {
  date_time: "Date",
  location: "Location",
  shape: "Shape",
  duration: "Duration",
  observers: "Obs.",
  quality: "Quality",
  evidence: "Evid.",
  signals: "Signals",
};

export default function SightingTable({ groups, columns, selectedCaseId, onSelectCase, loading }) {
  const shouldReduceMotion = useReducedMotion();

  if (loading) return <LoadingSkeleton rows={8} columns={columns.length} />;

  if (!Array.isArray(groups) || !groups.length) {
    return <EmptyState title="No sightings" description="Adjust your filters to see results." />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="surface-card overflow-hidden">
          <header className="flex items-center justify-between border-b border-white/[0.06] bg-surface-elevated/50 px-4 py-2.5">
            <h3 className="text-caption font-semibold text-slate-200">
              {group.key}
            </h3>
            <span className="text-micro text-slate-500">{group.items.length}</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {columns.map((col) => (
                    <th
                      key={`${group.key}-${col}`}
                      className="px-4 py-2 text-micro font-medium text-slate-500"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {COL_TITLES[col] || col}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-micro font-medium text-slate-500" style={{ letterSpacing: "0.04em" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, index) => {
                  const active = selectedCaseId === item.sighting_id;
                  const animateRow = !shouldReduceMotion && group.items.length <= 40 && index < 18;

                  const rowCls = `border-b border-white/[0.03] transition-colors cursor-pointer ${
                    active
                      ? "bg-accent-muted"
                      : "hover:bg-white/[0.02]"
                  }`;

                  const cells = (
                    <>
                      {columns.map((col) => (
                        <td key={`${item.sighting_id}-${col}`} className="px-4 py-2.5 text-caption text-slate-300" onClick={() => onSelectCase(item.sighting_id)}>
                          {col === "quality" ? (
                            <QualityBadge label={item.quality_label} score={item.quality_score} />
                          ) : (
                            renderCell(item, col)
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <m.button
                          type="button"
                          onClick={() => onSelectCase(item.sighting_id)}
                          whileTap={{ scale: 0.96, transition: springs.snappy }}
                          className={`rounded-lg border px-2.5 py-1 text-micro font-medium transition-colors ${
                            active
                              ? "border-accent/30 bg-accent-muted text-accent"
                              : "border-white/[0.08] text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
                          }`}
                        >
                          Open
                        </m.button>
                      </td>
                    </>
                  );

                  if (animateRow) {
                    return (
                      <m.tr
                        key={item.sighting_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={rowTransition(index)}
                        className={rowCls}
                      >
                        {cells}
                      </m.tr>
                    );
                  }

                  return (
                    <tr key={item.sighting_id} className={rowCls}>
                      {cells}
                    </tr>
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
