import { useCallback, useEffect } from "react";
import { usePivotState } from "./usePivotState";
import { useSightings } from "./useSightings";
import { useCaseFile } from "./useCaseFile";
import { useCompare } from "./useCompare";
import { useSampling } from "./useSampling";
import { usePulseStats } from "./usePulseStats";
import { useBookmarks } from "./useBookmarks";

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
    setKeyword,
    setSignalFilter,
    selectCase,
    prevPage,
    nextPage,
    updateCompare,
    patchState,
  } = usePivotState();

  const { items, meta, groupedItems, loadingMain, error: sightingsError, patchItem } = useSightings(state);

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

  const {
    bookmarks,
    collections,
    loading: loadingBookmarks,
    refreshBookmarks,
    refreshCollections,
    toggleBookmark: rawToggleBookmark,
    updateBookmark,
    createCollection,
    addToCollection,
    removeFromCollection,
  } = useBookmarks();

  const setOrder = useCallback((order) => {
    patchState({ order, offset: 0 });
  }, [patchState]);

  const toggleBookmark = useCallback(async (sightingId, isCurrentlyBookmarked) => {
    // Optimistic update
    patchItem(sightingId, { is_bookmarked: !isCurrentlyBookmarked });
    try {
      await rawToggleBookmark(sightingId, isCurrentlyBookmarked);
      await refreshBookmarks();
    } catch {
      // Revert on error
      patchItem(sightingId, { is_bookmarked: isCurrentlyBookmarked });
    }
  }, [rawToggleBookmark, refreshBookmarks, patchItem]);

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
    setKeyword,
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
    setOrder,
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
  };
}
