import { useState } from "react";
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

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user" transition={globalTransition}>
        <main className="relative z-10 mx-auto w-full max-w-[1720px] px-3 pb-6 pt-3 sm:px-6 lg:px-8">
        <header className="mb-3 grid gap-3 xl:grid-cols-[1fr_auto]">
          <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="panel-title">Sightings Board vNext</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100">
                Pivot-first investigation workspace
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openSampling}
                className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100"
              >
                Sample cases
              </button>
              {state.sampleSetId ? (
                <button
                  type="button"
                  onClick={clearSampleSet}
                  className="rounded-full border border-slate-500/40 bg-slate-900/75 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200"
                >
                  Clear sample set
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setFocusMode((current) => !current)}
                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${
                  focusMode
                    ? "border-amber-300/60 bg-amber-500/12 text-amber-100"
                    : "border-slate-500/40 bg-slate-900/75 text-slate-200"
                }`}
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
                className={`grid items-start gap-3 ${focusMode ? "xl:grid-cols-1" : "xl:grid-cols-[1.22fr_0.78fr]"}`}
              >
                {!focusMode ? (
                  <section className={`space-y-3 ${mobilePane === "case" ? "hidden xl:block" : ""}`}>
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
                  {!focusMode ? (
                    <div className="mb-2 flex items-center justify-between gap-2 xl:hidden">
                      <button
                        type="button"
                        onClick={() => setMobilePane("results")}
                        className="rounded-full border border-slate-500/40 bg-slate-900/75 px-3 py-1 text-xs uppercase tracking-[0.12em] text-slate-200"
                      >
                        Back To Results
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobilePane("case")}
                        className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-3 py-1 text-xs uppercase tracking-[0.12em] text-cyan-100"
                      >
                        Case File
                      </button>
                    </div>
                  ) : null}
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
                </section>
              </m.div>
            )}
          </AnimatePresence>
        </m.section>
      </main>

      {state.mode === "explore" && !focusMode ? (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-slate-500/40 bg-night-950/95 p-1 shadow-panel xl:hidden">
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
