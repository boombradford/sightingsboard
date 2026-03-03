import { useCallback, useEffect, useState } from "react";
import { fetchJSON, patchJSON, postJSON } from "../lib/api";
import { describeError } from "../lib/format";

export function useCaseFile(state, items) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [briefVersions, setBriefVersions] = useState([]);
  const [briefDiff, setBriefDiff] = useState(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [caseError, setCaseError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!state.selectedCaseId || state.mode === "compare") {
      setSelectedCase(null);
      setBriefVersions([]);
      return;
    }

    async function loadCase() {
      setLoadingCase(true);
      try {
        const [casePayload, briefPayload] = await Promise.all([
          fetchJSON(`/api/cases/${state.selectedCaseId}`),
          fetchJSON(`/api/cases/${state.selectedCaseId}/briefs`),
        ]);
        if (cancelled) return;
        setSelectedCase(casePayload || null);
        setBriefVersions(Array.isArray(briefPayload?.items) ? briefPayload.items : []);
      } catch (err) {
        if (!cancelled) {
          const fallback = Array.isArray(items)
            ? items.find((item) => Number(item?.sighting_id) === Number(state.selectedCaseId))
            : null;
          if (fallback) {
            setSelectedCase((cur) => {
              if (cur && Number(cur.sighting_id) === Number(state.selectedCaseId)) return cur;
              return {
                ...fallback,
                evidence: Array.isArray(fallback.evidence) ? fallback.evidence : [],
                evidence_count: Number(fallback.evidence_count ?? 0),
                enrichment_count: Number(fallback.enrichment_count ?? 0),
                ai_briefs: Array.isArray(fallback.ai_briefs) ? fallback.ai_briefs : [],
              };
            });
          }
          setCaseError(`Could not load case file: ${describeError(err)}`);
        }
      } finally {
        if (!cancelled) setLoadingCase(false);
      }
    }

    loadCase();
    return () => { cancelled = true; };
  }, [state.selectedCaseId, state.mode]);

  const addEvidence = useCallback(async (evidencePayload) => {
    if (!state.selectedCaseId) throw new Error("Select a case first.");
    await postJSON(`/api/cases/${state.selectedCaseId}/evidence`, evidencePayload);
    const casePayload = await fetchJSON(`/api/cases/${state.selectedCaseId}`);
    setSelectedCase(casePayload || null);
  }, [state.selectedCaseId]);

  const editEvidence = useCallback(async (evidenceId, evidencePayload) => {
    if (!state.selectedCaseId) throw new Error("Select a case first.");
    await patchJSON(`/api/cases/${state.selectedCaseId}/evidence/${evidenceId}`, evidencePayload);
    const casePayload = await fetchJSON(`/api/cases/${state.selectedCaseId}`);
    setSelectedCase(casePayload || null);
  }, [state.selectedCaseId]);

  const generateBrief = useCallback(async () => {
    if (!state.selectedCaseId) throw new Error("Select a case first.");
    await postJSON(`/api/cases/${state.selectedCaseId}/briefs`, {});
    const [casePayload, briefPayload] = await Promise.all([
      fetchJSON(`/api/cases/${state.selectedCaseId}`),
      fetchJSON(`/api/cases/${state.selectedCaseId}/briefs`),
    ]);
    setSelectedCase(casePayload || null);
    setBriefVersions(Array.isArray(briefPayload?.items) ? briefPayload.items : []);
  }, [state.selectedCaseId]);

  const compareBriefVersions = useCallback(async (leftId, rightId) => {
    if (!state.selectedCaseId) throw new Error("Select a case first.");
    const payload = await fetchJSON(
      `/api/cases/${state.selectedCaseId}/briefs/compare?left=${leftId}&right=${rightId}`
    );
    setBriefDiff(payload || null);
    return payload;
  }, [state.selectedCaseId]);

  const reportBriefIssue = useCallback(async (briefId, reasonCode, notes) => {
    if (!state.selectedCaseId) throw new Error("Select a case first.");
    return postJSON(`/api/cases/${state.selectedCaseId}/briefs/${briefId}/issues`, {
      reason_code: reasonCode,
      notes,
    });
  }, [state.selectedCaseId]);

  const closeBriefDiff = useCallback(() => setBriefDiff(null), []);

  return {
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
  };
}
