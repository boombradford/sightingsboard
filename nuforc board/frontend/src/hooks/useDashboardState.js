import { useEffect } from "react";
import { usePivotState } from "./usePivotState";
import { useSightings } from "./useSightings";
import { useCaseFile } from "./useCaseFile";
import { useCompare } from "./useCompare";
import { useSampling } from "./useSampling";
import { usePulseStats } from "./usePulseStats";

export function useDashboardState() {
  const {
    state,
    pivot,
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
    patchState,
  } = usePivotState();

  const { items, meta, groupedItems, loadingMain, error: sightingsError } = useSightings(state, selectCase);

  const {
    selectedCase,
    briefVersions,
    briefDiff,
    loadingCase,
    caseError,
    addEvidence,
    editEvidence,
    generateBrief,
    compareBriefVersions,
    reportBriefIssue,
    closeBriefDiff,
  } = useCaseFile(state, items);

  const { compareResult, loadingCompare, compareError, compareGuard, refreshCompare } = useCompare(state);

  const {
    sampleResult,
    sampleSets,
    samplingOpen,
    samplingConfig,
    refreshSampleSets,
    openSampling,
    closeSampling,
    setSamplingOption,
    generateSample,
    saveSampleSet,
    openSampleSet,
    clearSampleSet,
  } = useSampling(state, patchState);

  const { options, stats, loadingStats, statsError, pulse } = usePulseStats(meta);

  // Load sample sets on mount
  useEffect(() => { refreshSampleSets(); }, [refreshSampleSets]);

  const error = sightingsError || caseError || compareError || statsError;

  return {
    state,
    options,
    stats,
    pivot,
    items,
    meta,
    groupedItems,
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
    editEvidence,
    generateBrief,
    compareBriefVersions,
    reportBriefIssue,
    closeBriefDiff,
  };
}
