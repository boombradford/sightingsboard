import { useCallback, useEffect, useMemo, useState } from "react";
import { postJSON } from "../lib/api";
import { toComparePayload } from "../lib/dashboardQuery";
import { describeError } from "../lib/format";

export function useCompare(state) {
  const [compareResult, setCompareResult] = useState({ cohorts: [], baseline: null });
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState("");

  const refreshCompare = useCallback(async () => {
    if (state.mode !== "compare") return;
    setLoadingCompare(true);
    try {
      const payload = await postJSON("/api/compare", toComparePayload(state));
      setCompareResult(payload || { cohorts: [], baseline: null });
    } catch (err) {
      setCompareResult({ cohorts: [], baseline: null });
      setCompareError(`Could not run compare: ${describeError(err)}`);
    } finally {
      setLoadingCompare(false);
    }
  }, [state]);

  useEffect(() => { refreshCompare(); }, [refreshCompare]);

  const compareGuard = useMemo(() => {
    if (state.mode !== "compare") return "";
    if (!state.compare.cohortA || !state.compare.cohortB) return "Define both cohorts before comparing.";
    return "";
  }, [state.compare, state.mode]);

  return { compareResult, loadingCompare, compareError, compareGuard, refreshCompare };
}
