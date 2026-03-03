import { useEffect, useState } from "react";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m, useReducedMotion } from "framer-motion";
import CasePreviewPane from "./features/casefile/CasePreviewPane";
import CompareBoard from "./features/compare/CompareBoard";
import CompareSwitch from "./features/compare/CompareSwitch";
import PivotBar from "./features/pivot/PivotBar";
import ColumnChooser from "./features/results/ColumnChooser";
import GroupByControl from "./features/results/GroupByControl";
import PatternStrip from "./features/results/PatternStrip";
import SightingTable from "./features/results/SightingTable";
import SamplingDrawer from "./features/sampling/SamplingDrawer";
import { useDashboardState } from "./hooks/useDashboardState";
import { iosPaneVariants, iosSprings } from "./lib/iosMotion";

function formatPulseDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

export default function App() {
  const shouldReduceMotion = useReducedMotion();
  const [focusMode, setFocusMode] = useState(false);
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
  const globalTransition = shouldReduceMotion ? { duration: 0 } : iosSprings.smooth;
  const showMobilePaneSwitch = state.mode === "explore" && !focusMode && mobilePane === "results";
  const mainBottomPaddingClass = showMobilePaneSwitch ? "pb-28" : "pb-6";

  useEffect(() => {
    if (mobilePane === "case" && !state.selectedCaseId) {
      setMobilePane("results");
    }
  }, [mobilePane, state.selectedCaseId]);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user" transition={globalTransition}>
        <div className="vitrine-shard vitrine-shard-a" />
        <div className="vitrine-shard vitrine-shard-b" />
        <div className="vitrine-shell">
          <aside className="vitrine-rail hidden lg:flex">
            <div className="vitrine-logo-box">
              <span className="sr-only">Sightings Board</span>
            </div>
            <button type="button" className="vitrine-rail-item is-active" aria-label="Dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button type="button" className="vitrine-rail-item" aria-label="Insights">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </button>
            <button type="button" className="vitrine-rail-item" aria-label="Signals">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
            </button>
            <button type="button" className="vitrine-rail-item mt-auto" aria-label="Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33" />
                <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6" />
                <path d="M9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15" />
                <path d="M15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9" />
              </svg>
            </button>
          </aside>

          <main
            className={`relative z-10 mx-auto w-full max-w-[1600px] px-3 pt-3 ${mainBottomPaddingClass} sm:px-6 lg:px-8 xl:pb-6`}
          >
            <header className="mb-3 grid gap-3 xl:grid-cols-[1fr_auto]">
            <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="panel-title">Current Environment: Submerged Obsidian Vitrine</p>
                <h1 className="vitrine-main-title mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Suspended Investigation Operations
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openSampling}
                  className="btn-crystal"
                >
                  Sample cases
                </button>
                {state.sampleSetId ? (
                  <button
                    type="button"
                    onClick={clearSampleSet}
                    className="btn-crystal"
                  >
                    Clear sample set
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setFocusMode((current) => !current)}
                  className={`btn-crystal ${focusMode ? "ring-1 ring-cyan-300/50" : ""}`}
                >
                  {focusMode ? "Exit focus" : "Focus mode"}
                </button>
              </div>
            </div>

            <div className="glass-card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Total sightings</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{pulse.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Slice size</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{pulse.slice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Geocoded %</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{pulse.geocodedPct}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Slice updated</p>
                <p className="mt-1 text-xs font-mono text-slate-200">{formatPulseDate(pulse.updatedAt)}</p>
              </div>
            </div>
          </header>

          <CompareSwitch
            mode={state.mode}
            includeBaseline={state.compare.includeBaseline}
            onModeChange={updateMode}
            onBaselineChange={(checked) => updateCompare({ includeBaseline: checked })}
          />

          <PivotBar
            state={state}
            options={options}
            pivot={pivot}
            onPivotChange={updatePivot}
            onTogglePin={togglePin}
            onUpdateSlice={updateSlice}
          />

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-900/25 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <m.section layout className="mt-3">
            <AnimatePresence mode="wait" initial={false}>
              {state.mode === "compare" ? (
                <m.div
                  key="compare-mode"
                  variants={iosPaneVariants}
                  initial="initial"
                  animate="animate"
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
                  variants={iosPaneVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`grid items-start gap-3 ${
                    focusMode ? "xl:grid-cols-1" : "xl:grid-cols-[1.22fr_0.78fr]"
                  }`}
                >
                  {!focusMode ? (
                    <section
                      className={`space-y-3 ${showMobilePaneSwitch ? "pb-20" : ""} ${
                        mobilePane === "case" ? "hidden xl:block" : ""
                      }`}
                    >
                      <div className="glass-card flex flex-wrap items-center justify-between gap-2 p-3">
                        <GroupByControl value={state.groupBy} onChange={setGroupBy} />
                        <ColumnChooser columns={state.columns} onToggle={toggleColumn} />
                      </div>

                      <PatternStrip
                        signals={meta.slice_signals}
                        activeSignal={state.signal}
                        onToggleSignal={setSignalFilter}
                      />

                      <SightingTable
                        groups={groupedItems}
                        columns={state.columns}
                        selectedCaseId={state.selectedCaseId}
                        onSelectCase={(sightingId) => {
                          selectCase(sightingId);
                          setMobilePane("case");
                        }}
                        loading={loadingMain || loadingStats}
                      />

                      <div className="glass-card flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-slate-300">
                        <p>
                          Showing {shownRows.toLocaleString()} of {totalRows.toLocaleString()} in this page slice.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={prevPage}
                            disabled={loadingMain || offset <= 0 || state.sampleSetId}
                            className="rounded-full border border-slate-500/40 bg-slate-900/75 px-3 py-1 disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={nextPage}
                            disabled={loadingMain || shownRows === 0 || state.sampleSetId}
                            className="rounded-full border border-slate-500/40 bg-slate-900/75 px-3 py-1 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <section
                    className={`${focusMode ? "" : "xl:sticky xl:top-[10.1rem] xl:max-h-[calc(100vh-11rem)]"} ${
                      !focusMode && mobilePane === "results" ? "hidden xl:block" : ""
                    }`}
                  >
                    <CasePreviewPane
                      loading={loadingCase}
                      caseItem={selectedCase}
                      briefVersions={briefVersions}
                      briefDiff={briefDiff}
                      onBack={!focusMode && state.mode === "explore" ? () => setMobilePane("results") : null}
                      onCloseBriefDiff={closeBriefDiff}
                      onAddEvidence={addEvidence}
                      onGenerateBrief={generateBrief}
                      onCompareBriefs={compareBriefVersions}
                      onReportBriefIssue={reportBriefIssue}
                      onSignalClick={setSignalFilter}
                    />
                  </section>
                </m.div>
              )}
            </AnimatePresence>
          </m.section>
          </main>
        </div>

        {showMobilePaneSwitch ? (
          <div className="fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 xl:hidden">
            <div className="w-full max-w-sm rounded-full border border-slate-500/40 bg-night-950/95 p-1 shadow-panel">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setMobilePane("results")}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${
                    mobilePane === "results" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
                  }`}
                >
                  Results
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePane("case")}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${
                    mobilePane === "case" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
                  }`}
                >
                  Case File
                </button>
              </div>
            </div>
          </div>
        ) : null}

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
      </MotionConfig>
    </LazyMotion>
  );
}
