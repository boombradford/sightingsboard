import { useCallback, useEffect, useMemo, useState } from "react";
import { m } from "motion/react";
import { fadeUp, springs } from "../../lib/motion";
import ShapeIcon from "../shared/ShapeIcon";
import EmptyState from "../shared/EmptyState";

const STATUSES = ["new", "scripted", "filmed", "published"];

const STATUS_TABS = [
  { id: null, label: "All" },
  { id: "new", label: "New" },
  { id: "scripted", label: "Scripted" },
  { id: "filmed", label: "Filmed" },
  { id: "published", label: "Published" },
];

const STATUS_COLORS = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scripted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  filmed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
};

const STATUS_HEADER_COLORS = {
  new: "text-blue-400",
  scripted: "text-amber-400",
  filmed: "text-purple-400",
  published: "text-green-400",
};

function KanbanCard({ bookmark, onSelectCase, onUpdateBookmark, onToggleBookmark }) {
  const handleStatusChange = (e) => {
    e.stopPropagation();
    onUpdateBookmark(bookmark.sighting_id, { status: e.target.value });
  };

  return (
    <div
      className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 cursor-pointer"
      onClick={() => onSelectCase(bookmark.sighting_id)}
    >
      <div className="flex items-center gap-2">
        <ShapeIcon shape={bookmark.shape} size={16} className="text-zinc-400 shrink-0" />
        <span className="font-mono text-caption font-semibold text-amber-400">
          #{bookmark.sighting_id}
        </span>
      </div>
      <p className="text-micro text-zinc-300 truncate">
        {bookmark.city}, {bookmark.state}
      </p>
      <p className="text-micro text-zinc-500">{bookmark.date_time}</p>
      {bookmark.notes && (
        <p className="text-micro text-zinc-500 truncate">{bookmark.notes}</p>
      )}
      <div className="mt-1 flex items-center gap-2">
        <select
          value={bookmark.status || "new"}
          onChange={handleStatusChange}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-micro text-zinc-300 focus:border-amber-500/50 focus:outline-none"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark(bookmark.sighting_id, true);
          }}
          className="shrink-0 rounded p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
          title="Remove"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function PipelineView({
  bookmarks,
  collections,
  loading,
  onRefresh,
  onSelectCase,
  onUpdateBookmark,
  onToggleBookmark,
}) {
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    onRefresh(statusFilter);
  }, [statusFilter, onRefresh]);

  const columns = useMemo(() => {
    const map = {};
    for (const s of STATUSES) map[s] = [];
    for (const b of bookmarks) {
      const status = STATUSES.includes(b.status) ? b.status : "new";
      map[status].push(b);
    }
    return map;
  }, [bookmarks]);

  const filtered = statusFilter
    ? bookmarks.filter((b) => b.status === statusFilter)
    : bookmarks;

  return (
    <m.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-zinc-100">Content Pipeline</h2>
        <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-micro text-zinc-400">
          {bookmarks.length} saved
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-800/50" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <EmptyState
          title="No saved cases"
          description="Save cases from the Explore view to build your pipeline."
        />
      ) : (
        <>
          {/* Desktop: Kanban board */}
          <div className="hidden md:grid md:grid-cols-4 md:gap-3">
            {STATUSES.map((status) => (
              <div key={status} className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
                  <span className={`text-caption font-semibold capitalize ${STATUS_HEADER_COLORS[status]}`}>
                    {status}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-micro text-zinc-500">
                    {columns[status].length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  {columns[status].length === 0 ? (
                    <p className="py-6 text-center text-micro text-zinc-600">No cases</p>
                  ) : (
                    columns[status].map((bookmark) => (
                      <KanbanCard
                        key={bookmark.sighting_id}
                        bookmark={bookmark}
                        onSelectCase={onSelectCase}
                        onUpdateBookmark={onUpdateBookmark}
                        onToggleBookmark={onToggleBookmark}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: tab-based flat list */}
          <div className="md:hidden space-y-3">
            <div className="flex gap-1.5 overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id ?? "all"}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md border px-3 py-1.5 text-micro font-medium transition-colors ${
                    statusFilter === tab.id
                      ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-400"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No saved cases"
                description={statusFilter ? `No cases with status "${statusFilter}".` : "Save cases from the Explore view to build your pipeline."}
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((bookmark) => (
                  <div
                    key={bookmark.sighting_id}
                    className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors active:bg-zinc-800/60 cursor-pointer"
                    onClick={() => onSelectCase(bookmark.sighting_id)}
                  >
                    <ShapeIcon shape={bookmark.shape} size={20} className="text-zinc-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-caption font-semibold text-amber-400">
                          #{bookmark.sighting_id}
                        </span>
                        <span className="text-caption text-zinc-300 truncate">
                          {bookmark.city}, {bookmark.state}
                        </span>
                      </div>
                      <p className="mt-0.5 text-micro text-zinc-500">{bookmark.date_time}</p>
                      {bookmark.notes && (
                        <p className="mt-0.5 text-micro text-zinc-500 truncate">{bookmark.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`rounded-md border px-2 py-0.5 text-micro font-medium ${STATUS_COLORS[bookmark.status] || STATUS_COLORS.new}`}>
                        {bookmark.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(bookmark.sighting_id, true);
                        }}
                        className="p-1 text-zinc-600 active:text-red-400"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Collections */}
      {collections.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-mono text-micro uppercase tracking-wider text-zinc-500">Collections</h3>
          <div className="space-y-1.5">
            {collections.map((col) => (
              <div key={col.collection_id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-caption text-zinc-200">{col.name}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-micro text-zinc-500">
                  {col.item_count} items
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </m.div>
  );
}
