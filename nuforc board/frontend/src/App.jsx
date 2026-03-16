import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import AppShell from "./features/layout/AppShell";
import TopBar from "./features/layout/TopBar";
import DetailPanel from "./features/layout/DetailPanel";
import CasePreviewPane from "./features/casefile/CasePreviewPane";
import CompareBoard from "./features/compare/CompareBoard";
import PivotFilterBar from "./features/pivot/PivotFilterBar";
import ColumnChooser from "./features/results/ColumnChooser";
import GroupByControl from "./features/results/GroupByControl";
import PatternStrip from "./features/results/PatternStrip";
import SightingTable from "./features/results/SightingTable";
import DashboardStats from "./features/results/DashboardStats";
import HeroBanner from "./features/results/HeroBanner";
import SamplingDrawer from "./features/sampling/SamplingDrawer";

const MapView = lazy(() => import("./features/results/MapView"));
import PipelineView from "./features/pipeline/PipelineView";
import DiscoverView from "./features/discover/DiscoverView";
import { useDashboardState } from "./hooks/useDashboardState";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { fadeUp, springs } from "./lib/motion";

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const {
    state,
    options,
    stats,
    pivot,
    groupedItems,
    meta,
    compareResult,
    selectedCase,
    briefVersions,
    briefDiff,
    sampleResult,
    sampleSets,
    samplingOpen,
    samplingConfig,
    loadingMain,
    loadingStats,
    loadingCase,
    loadingCompare,
    error,
    pulse,
    compareGuard,
    updatePivot,
    updateMode,
    togglePin,
    updateSlice,
    setGroupBy,
    toggleColumn,
    setSignalFilter,
    selectCase,
    prevPage,
    nextPage,
    updateCompare,
    refreshCompare,
    openSampling,
    closeSampling,
    setSamplingOption,
    generateSample,
    saveSampleSet,
    openSampleSet,
    clearSampleSet,
    addEvidence,
    generateBrief,
    compareBriefVersions,
    reportBriefIssue,
    closeBriefDiff,
    setOrder,
    setKeyword,
    toggleBookmark,
    updateBookmark,
    bookmarks,
    collections,
    loadingBookmarks,
    refreshBookmarks,
    refreshCollections,
    createCollection,
    addToCollection,
    removeFromCollection,
  } = useDashboardState();

  const flatItems = groupedItems.flatMap((g) => g.items);
  useKeyboardNav({ items: flatItems, selectedCaseId: state.selectedCaseId, selectCase, toggleBookmark });

  const totalRows = Number(meta?.total || 0);
  const shownRows = Number(meta?.returned || 0);
  const offset = Number(meta?.offset || 0);
  const currentPage = shownRows > 0 ? Math.floor(offset / shownRows) + 1 : 1;
  const totalPages = shownRows > 0 ? Math.ceil(totalRows / shownRows) : 1;

  const sidebarProps = {
    collapsed: sidebarCollapsed,
    mode: state.mode,
    pulse,
    onModeChange: updateMode,
    onSampling: openSampling,
  };

  const breadcrumb = [
    "Sky Ledger Atlas",
    state.mode === "compare" ? "Compare" : state.mode === "pipeline" ? "Pipeline" : state.mode === "discover" ? "Discover" : "Explore",
    ...(state.pivot.shape ? [`Shape: ${state.pivot.shape}`] : []),
    ...(state.pivot.state ? [`State: ${state.pivot.state}`] : []),
    ...(state.signal ? [`Signal: ${state.signal}`] : []),
  ];

  // Debounced search
  const [searchInput, setSearchInput] = useState(state.keyword || "");
  const searchTimer = useRef(null);
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setKeyword(value), 300);
  }, [setKeyword]);

  const handleSelectCaseFromPipeline = (sightingId) => {
    updateMode("explore");
    selectCase(sightingId);
  };

  return (
    <AppShell sidebar={sidebarProps}>
      <TopBar
        breadcrumb={breadcrumb}
        actions={
          <div className="flex items-center gap-2">
            {state.sampleSetId && (
              <button type="button" onClick={clearSampleSet} className="btn-crystal">
                Clear sample
              </button>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="btn-crystal hidden md:inline-flex"
            >
              {sidebarCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        }
      >
        {state.mode === "explore" && (
          <PivotFilterBar
            state={state}
            options={options}
            pivot={pivot}
            onPivotChange={updatePivot}
            onTogglePin={togglePin}
            onUpdateSlice={updateSlice}
            onSignalFilter={setSignalFilter}
          />
        )}
      </TopBar>

      {/* Error bar */}
      <AnimatePresence>
        {error && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-950/20 px-5 py-2.5 text-caption text-red-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-red-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {error}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-3 pb-20 sm:p-4 lg:p-5">
          <AnimatePresence mode="wait" initial={false}>
            {state.mode === "pipeline" ? (
              <m.div
                key="pipeline-mode"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springs.cinematic}
              >
                <PipelineView
                  bookmarks={bookmarks}
                  collections={collections}
                  loading={loadingBookmarks}
                  onRefresh={refreshBookmarks}
                  onSelectCase={handleSelectCaseFromPipeline}
                  onUpdateBookmark={updateBookmark}
                  onToggleBookmark={toggleBookmark}
                />
              </m.div>
            ) : state.mode === "discover" ? (
              <m.div
                key="discover-mode"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springs.cinematic}
              >
                <DiscoverView
                  onSelectCase={handleSelectCaseFromPipeline}
                  onToggleBookmark={toggleBookmark}
                />
              </m.div>
            ) : state.mode === "compare" ? (
              <m.div
                key="compare-mode"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springs.cinematic}
              >
                <CompareBoard
                  options={options}
                  compare={state.compare}
                  result={compareResult}
                  loading={loadingCompare}
                  guard={compareGuard}
                  onChange={updateCompare}
                  onRun={refreshCompare}
                />
              </m.div>
            ) : (
              <m.div
                key="explore-mode"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={springs.cinematic}
                className="space-y-3"
              >
                {/* Hero banner */}
                <HeroBanner total={pulse?.total || totalRows} />

                {/* Dashboard stats */}
                <DashboardStats stats={stats} pulse={pulse} loading={loadingStats} />

                {/* Controls bar */}
                <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 sm:p-3">
                  {/* Search — full width on mobile */}
                  <div className="relative">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search cases…"
                      value={searchInput}
                      onChange={handleSearchChange}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-2 text-caption text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30 sm:w-auto sm:min-w-40 sm:py-1.5 lg:min-w-56"
                    />
                  </div>
                  {/* Filters row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <GroupByControl value={state.groupBy} onChange={setGroupBy} />
                    {/* Sort toggle */}
                    <div className="flex items-center gap-1 rounded-md border border-zinc-700 p-0.5">
                      {[
                        { id: "recent", label: "Recent" },
                        { id: "story_score", label: "Best" },
                        { id: "content_potential", label: "Content" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setOrder(opt.id)}
                          className={`rounded px-2 py-1 text-micro font-medium transition-colors sm:px-2.5 ${
                            state.order === opt.id
                              ? "bg-amber-500/10 text-amber-400"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowMap((v) => !v)}
                        className={`rounded px-2 py-1 text-micro font-medium transition-colors ${
                          showMap
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                        title={showMap ? "Show list" : "Show map"}
                      >
                        {showMap ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                            <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
                          </svg>
                        )}
                      </button>
                      <ColumnChooser columns={state.columns} onToggle={toggleColumn} />
                    </div>
                  </div>
                </div>

                <PatternStrip
                  signals={meta.slice_signals}
                  activeSignal={state.signal}
                  onToggleSignal={setSignalFilter}
                />

                {/* Map */}
                {showMap && (
                  <Suspense fallback={<div className="h-[420px] rounded-lg bg-zinc-900 shimmer-scan" />}>
                    <MapView items={flatItems} onSelectCase={selectCase} />
                  </Suspense>
                )}

                {/* Table */}
                <div>
                  <SightingTable
                    groups={groupedItems}
                    columns={state.columns}
                    selectedCaseId={state.selectedCaseId}
                    onSelectCase={selectCase}
                    onToggleBookmark={toggleBookmark}
                    loading={loadingMain || loadingStats}
                  />
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-caption text-zinc-300 sm:p-3">
                  <p className="font-mono text-micro text-zinc-400 sm:text-caption">
                    <span className="font-semibold text-zinc-200">{shownRows.toLocaleString()}</span>
                    <span className="hidden sm:inline"> of {totalRows.toLocaleString()}</span>
                    <span className="mx-1 text-zinc-600">·</span>
                    <span className="text-zinc-200">{currentPage}</span>/{totalPages}
                  </p>
                  <div className="flex gap-1.5">
                    <m.button
                      type="button"
                      onClick={prevPage}
                      disabled={loadingMain || offset <= 0 || state.sampleSetId}
                      whileTap={{ scale: 0.97, transition: springs.snappy }}
                      className="btn-crystal disabled:opacity-30"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 12L6 8l4-4" />
                      </svg>
                      <span className="hidden sm:inline">Previous</span>
                    </m.button>
                    <m.button
                      type="button"
                      onClick={nextPage}
                      disabled={loadingMain || shownRows === 0 || state.sampleSetId}
                      whileTap={{ scale: 0.97, transition: springs.snappy }}
                      className="btn-crystal disabled:opacity-30"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </m.button>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </main>

        {/* Full-page detail panel */}
        <DetailPanel visible={state.mode === "explore" && !!state.selectedCaseId} onClose={() => selectCase(null)}>
          <CasePreviewPane
            loading={loadingCase}
            caseItem={selectedCase}
            briefVersions={briefVersions}
            briefDiff={briefDiff}
            onBack={() => selectCase(null)}
            onCloseBriefDiff={closeBriefDiff}
            onAddEvidence={addEvidence}
            onGenerateBrief={generateBrief}
            onCompareBriefs={compareBriefVersions}
            onReportBriefIssue={reportBriefIssue}
            onSignalClick={setSignalFilter}
            onToggleBookmark={toggleBookmark}
            onUpdateBookmark={updateBookmark}
          />
        </DetailPanel>
      </div>

      {/* Sampling drawer */}
      <SamplingDrawer
        open={samplingOpen}
        onClose={closeSampling}
        config={samplingConfig}
        onConfig={setSamplingOption}
        onGenerate={generateSample}
        sampleResult={sampleResult}
        onSave={saveSampleSet}
        sampleSets={sampleSets}
        onOpenSet={openSampleSet}
        activeSetId={state.sampleSetId}
      />
    </AppShell>
  );
}
