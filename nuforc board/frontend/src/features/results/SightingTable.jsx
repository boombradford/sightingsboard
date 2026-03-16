import { useCallback, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import QualityBadge from "../quality/QualityBadge";
import ShapeIcon from "../shared/ShapeIcon";
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
  if (column === "shape") {
    const shape = item.shape || "unknown";
    return (
      <span className="inline-flex items-center gap-1.5">
        <ShapeIcon shape={shape} size={14} className="text-zinc-400" />
        <span className="capitalize">{shape}</span>
      </span>
    );
  }
  if (column === "duration") return item.duration || "unknown";
  if (column === "observers") return item.observer_count ?? "n/a";
  if (column === "evidence") return item.evidence_count ?? item.enrichment_count ?? 0;
  if (column === "signals") return shortSignals(item.signals);
  if (column === "score") {
    const score = item.story_score ?? 0;
    return (
      <span className={`font-mono text-micro font-bold ${
        score >= 60 ? "text-amber-400" : score >= 30 ? "text-zinc-300" : "text-zinc-500"
      }`}>
        {score}
      </span>
    );
  }
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
  score: "Score",
};

const SORTABLE_COLS = new Set(["date_time", "location", "shape", "score", "signals"]);

function getSortValue(item, col) {
  if (col === "date_time") return item.date_time || "";
  if (col === "location") return `${item.state || ""}${item.city || ""}`.toLowerCase();
  if (col === "shape") return (item.shape || "").toLowerCase();
  if (col === "score") return item.story_score ?? 0;
  if (col === "signals") return Array.isArray(item.signals) ? item.signals.length : 0;
  return 0;
}

function sortItems(items, col, dir) {
  if (!col) return items;
  const sorted = [...items].sort((a, b) => {
    const va = getSortValue(a, col);
    const vb = getSortValue(b, col);
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb));
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

function SortArrow({ active, dir }) {
  if (!active) {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-zinc-600 ml-1 inline-block">
        <polyline points="7 10 12 5 17 10" />
        <polyline points="7 14 12 19 17 14" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400 ml-1 inline-block">
      {dir === "asc" ? <polyline points="7 14 12 9 17 14" /> : <polyline points="7 10 12 15 17 10" />}
    </svg>
  );
}

/* ── Mobile card for a single sighting ────────────────────────── */
function MobileCard({ item, active, onSelectCase, onToggleBookmark }) {
  const score = item.story_score ?? 0;
  return (
    <div
      onClick={() => onSelectCase(item.sighting_id)}
      className={`flex gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
        active
          ? "border-amber-500/30 bg-amber-500/[0.06]"
          : "border-zinc-800 bg-zinc-900/50 active:bg-zinc-800/60"
      }`}
    >
      {/* Left: shape icon + score */}
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
        <ShapeIcon shape={item.shape} size={20} className="text-zinc-400" />
        <span className={`font-mono text-[10px] font-bold ${
          score >= 60 ? "text-amber-400" : score >= 30 ? "text-zinc-300" : "text-zinc-500"
        }`}>
          {score}
        </span>
      </div>

      {/* Middle: details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-caption font-medium text-zinc-100">
            {item.city || "?"}, {item.state || "--"}
          </span>
          <span className="shrink-0 capitalize text-micro text-zinc-500">{item.shape}</span>
        </div>
        <p className="mt-0.5 text-micro text-zinc-500">
          {item.date_time} · {item.duration || "?"}
        </p>
        {item.summary && (
          <p className="mt-1 text-micro leading-relaxed text-zinc-400 line-clamp-2">{item.summary}</p>
        )}
      </div>

      {/* Right: bookmark */}
      {onToggleBookmark && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(item.sighting_id, item.is_bookmarked);
          }}
          className="shrink-0 self-start p-1.5 -mr-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={item.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
            className={item.is_bookmarked ? "text-amber-400" : "text-zinc-600"}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SightingTable({ groups, columns, selectedCaseId, onSelectCase, onToggleBookmark, loading }) {
  const shouldReduceMotion = useReducedMotion();
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = useCallback((col) => {
    if (!SORTABLE_COLS.has(col)) return;
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "score" || col === "signals" ? "desc" : "asc");
    }
  }, [sortCol]);

  if (loading) return <LoadingSkeleton rows={8} columns={columns.length} />;

  if (!Array.isArray(groups) || !groups.length) {
    return <EmptyState title="No sightings" description="Adjust your filters to see results." />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const sortedItems = sortCol ? sortItems(group.items, sortCol, sortDir) : group.items;
        return (
        <section key={group.key} className="overflow-hidden rounded-lg border border-zinc-800">
          <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2 sm:px-4 sm:py-2.5">
            <h3 className="font-display text-caption font-semibold text-zinc-200">
              {group.key}
            </h3>
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-micro text-zinc-400">
              {group.items.length}
            </span>
          </header>

          {/* Mobile: card list */}
          <div className="space-y-1.5 p-2 sm:hidden">
            {sortedItems.map((item) => (
              <MobileCard
                key={item.sighting_id}
                item={item}
                active={selectedCaseId === item.sighting_id}
                onSelectCase={onSelectCase}
                onToggleBookmark={onToggleBookmark}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-950">
                  <th className="w-8 px-2 py-2" />
                  <th className="w-12 px-3 py-2 text-right font-mono text-micro font-medium text-zinc-500">
                    #
                  </th>
                  {columns.map((col) => {
                    const sortable = SORTABLE_COLS.has(col);
                    return (
                      <th
                        key={`${group.key}-${col}`}
                        onClick={() => sortable && handleSort(col)}
                        className={`px-4 py-2 font-mono text-micro font-medium uppercase tracking-wider select-none ${
                          sortable
                            ? "cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors"
                            : "text-zinc-500"
                        } ${sortCol === col ? "text-amber-400" : ""}`}
                      >
                        {COL_TITLES[col] || col}
                        {sortable && <SortArrow active={sortCol === col} dir={sortDir} />}
                      </th>
                    );
                  })}
                  <th className="px-4 py-2 font-mono text-micro font-medium uppercase tracking-wider text-zinc-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => {
                  const active = selectedCaseId === item.sighting_id;
                  const animateRow = !shouldReduceMotion && group.items.length <= 40 && index < 18;

                  const rowCls = `border-b border-zinc-800/30 transition-colors cursor-pointer ${
                    active
                      ? "bg-amber-500/[0.06] shadow-[inset_3px_0_0_rgba(245,158,11,0.7)]"
                      : "hover:bg-zinc-800/40 hover:shadow-[inset_3px_0_0_rgba(245,158,11,0.15)]"
                  }`;

                  const cells = (
                    <>
                      <td className="w-8 px-2 py-2.5 text-center">
                        {onToggleBookmark && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleBookmark(item.sighting_id, item.is_bookmarked);
                            }}
                            className="p-1 text-zinc-600 hover:text-amber-400 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={item.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
                              className={item.is_bookmarked ? "text-amber-400" : ""}
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="w-12 px-3 py-2.5 text-right font-mono text-micro text-zinc-600" onClick={() => onSelectCase(item.sighting_id)}>
                        {index + 1}
                      </td>
                      {columns.map((col) => (
                        <td key={`${item.sighting_id}-${col}`} className="px-4 py-2.5 text-caption text-zinc-200" onClick={() => onSelectCase(item.sighting_id)}>
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
                          whileTap={{ scale: 0.97, transition: springs.snappy }}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-micro font-medium transition-colors ${
                            active
                              ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
                              : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Open
                        </m.button>
                      </td>
                    </>
                  );

                  if (animateRow) {
                    return (
                      <m.tr
                        key={item.sighting_id}
                        initial={{ opacity: 0, y: 4 }}
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
        );
      })}
    </div>
  );
}
