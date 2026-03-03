import { useEffect, useState } from "react";
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
import SamplingDrawer from "./features/sampling/SamplingDrawer";
import { useDashboardState } from "./hooks/useDashboardState";
import { fadeUp, springs } from "./lib/motion";

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobilePane, setMobilePane] = useState("results");

  const {
    state,
    options,
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
  } = useDashboardState();

  const totalRows = Number(meta?.total || 0);
  const shownRows = Number(meta?.returned || 0);
  const offset = Number(meta?.offset || 0);

  useEffect(() => {
    if (mobilePane === "case" && !state.selectedCaseId) setMobilePane("results");
  }, [mobilePane, state.selectedCaseId]);

  const sidebarProps = {
    collapsed: sidebarCollapsed,
    mode: state.mode,
    pulse,
    onModeChange: updateMode,
    onSampling: openSampling,
  };

  return (
    <AppShell sidebar={sidebarProps}>
      {/* Top Bar with pivot filters */}
      <TopBar
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
        <PivotFilterBar
          state={state}
          options={options}
          pivot={pivot}
          onPivotChange={updatePivot}
          onTogglePin={togglePin}
          onUpdateSlice={updateSlice}
        />
      </TopBar>

      {/* Error bar */}
      {error && (
        <div className="border-b border-rose-500/20 bg-rose-950/30 px-5 py-2.5 text-caption text-rose-200">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-5">
          <AnimatePresence mode="wait" initial={false}>
            {state.mode === "compare" ? (
              <m.div
                key="compare-mode"
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
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
                className="space-y-3"
              >
                {/* Controls bar */}
                <div className="surface-card flex flex-wrap items-center justify-between gap-2 p-3">
                  <GroupByControl value={state.groupBy} onChange={setGroupBy} />
                  <ColumnChooser columns={state.columns} onToggle={toggleColumn} />
                </div>

                <PatternStrip
                  signals={meta.slice_signals}
                  activeSignal={state.signal}
                  onToggleSignal={setSignalFilter}
                />

                {/* Table */}
                <div className={mobilePane === "case" ? "hidden xl:block" : ""}>
                  <SightingTable
                    groups={groupedItems}
                    columns={state.columns}
                    selectedCaseId={state.selectedCaseId}
                    onSelectCase={(id) => {
                      selectCase(id);
                      setMobilePane("case");
                    }}
                    loading={loadingMain || loadingStats}
                  />
                </div>

                {/* Pagination */}
                <div className="surface-card flex flex-wrap items-center justify-between gap-2 p-3 text-caption text-slate-400">
                  <p>
                    Showing {shownRows.toLocaleString()} of {totalRows.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={prevPage}
                      disabled={loadingMain || offset <= 0 || state.sampleSetId}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-caption disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={nextPage}
                      disabled={loadingMain || shownRows === 0 || state.sampleSetId}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-caption disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right detail panel */}
        <DetailPanel visible={state.mode === "explore" && !!state.selectedCaseId}>
          <CasePreviewPane
            loading={loadingCase}
            caseItem={selectedCase}
            briefVersions={briefVersions}
            briefDiff={briefDiff}
            onBack={() => setMobilePane("results")}
            onCloseBriefDiff={closeBriefDiff}
            onAddEvidence={addEvidence}
            onGenerateBrief={generateBrief}
            onCompareBriefs={compareBriefVersions}
            onReportBriefIssue={reportBriefIssue}
            onSignalClick={setSignalFilter}
          />
        </DetailPanel>
      </div>

      {/* Mobile case pane */}
      {state.mode === "explore" && mobilePane === "case" ? (
        <div className="fixed inset-x-0 bottom-12 top-[58px] z-20 bg-surface-deepest md:hidden">
          <div className="h-full overflow-y-auto p-3">
            <CasePreviewPane
              loading={loadingCase}
              caseItem={selectedCase}
              briefVersions={briefVersions}
              briefDiff={briefDiff}
              onBack={() => setMobilePane("results")}
              onCloseBriefDiff={closeBriefDiff}
              onAddEvidence={addEvidence}
              onGenerateBrief={generateBrief}
              onCompareBriefs={compareBriefVersions}
              onReportBriefIssue={reportBriefIssue}
              onSignalClick={setSignalFilter}
            />
          </div>
        </div>
      ) : null}

      {/* Mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] bg-surface-deepest/95 backdrop-blur-xl md:hidden">
        <div className="flex">
          {[
            { id: "results", label: "Results" },
            { id: "case", label: "Case File" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobilePane(tab.id)}
              className={`flex-1 py-3 text-caption font-medium ${
                mobilePane === tab.id ? "text-accent" : "text-slate-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
