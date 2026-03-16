import { useEffect } from "react";

export function useKeyboardNav({ items, selectedCaseId, selectCase, toggleBookmark }) {
  useEffect(() => {
    if (!items || !items.length) return;

    function handler(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;

      const flatIds = items.map((item) => item.sighting_id);
      const currentIdx = flatIds.indexOf(selectedCaseId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = currentIdx < flatIds.length - 1 ? currentIdx + 1 : 0;
        selectCase(flatIds[next]);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = currentIdx > 0 ? currentIdx - 1 : flatIds.length - 1;
        selectCase(flatIds[prev]);
      } else if (e.key === "s" && selectedCaseId) {
        e.preventDefault();
        const current = items.find((item) => item.sighting_id === selectedCaseId);
        if (current) toggleBookmark(selectedCaseId, current.is_bookmarked);
      } else if (e.key === "Escape") {
        e.preventDefault();
        selectCase(null);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items, selectedCaseId, selectCase, toggleBookmark]);
}
