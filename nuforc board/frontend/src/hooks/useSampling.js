import { useCallback, useState } from "react";
import { fetchJSON, postJSON } from "../lib/api";
import { toSamplePayload } from "../lib/dashboardQuery";

export function useSampling(state, patchState) {
  const [sampleResult, setSampleResult] = useState(null);
  const [sampleSets, setSampleSets] = useState([]);
  const [samplingOpen, setSamplingOpen] = useState(false);
  const [samplingConfig, setSamplingConfig] = useState({
    size: 10,
    strategy: "uniform",
    stratifyBy: "shape",
    hasCoordinates: false,
    hasSources: false,
    hasMedia: false,
  });

  const refreshSampleSets = useCallback(async () => {
    try {
      const payload = await fetchJSON("/api/sample-sets?limit=12");
      setSampleSets(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setSampleSets([]);
    }
  }, []);

  const openSampling = useCallback(() => setSamplingOpen(true), []);
  const closeSampling = useCallback(() => setSamplingOpen(false), []);

  const setSamplingOption = useCallback((patch) => {
    setSamplingConfig((cur) => ({ ...cur, ...patch }));
  }, []);

  const generateSample = useCallback(async () => {
    const payload = await postJSON("/api/samples/generate", toSamplePayload(state, samplingConfig));
    setSampleResult(payload || null);
    return payload;
  }, [samplingConfig, state]);

  const saveSampleSet = useCallback(async (name) => {
    if (!sampleResult?.items?.length) throw new Error("Generate a sample before saving.");
    const response = await postJSON("/api/sample-sets", {
      name,
      items: sampleResult.items,
      base_filters: {
        shape: state.pivot.shape || undefined,
        state: state.pivot.state || undefined,
        city: state.pivot.city || undefined,
        from_date: state.pivot.from_date || undefined,
        to_date: state.pivot.to_date || undefined,
      },
      strategy: {
        strategy: samplingConfig.strategy,
        stratify_by: samplingConfig.stratifyBy,
        size: samplingConfig.size,
      },
    });
    patchState({ sampleSetId: response.set_id || "", mode: "explore", offset: 0 });
    await refreshSampleSets();
    return response;
  }, [refreshSampleSets, sampleResult, samplingConfig, state.pivot, patchState]);

  const openSampleSet = useCallback((setId) => {
    patchState({ sampleSetId: setId || "", mode: "explore", offset: 0 });
    setSamplingOpen(false);
  }, [patchState]);

  const clearSampleSet = useCallback(() => {
    patchState({ sampleSetId: "", offset: 0 });
  }, [patchState]);

  return {
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
  };
}
