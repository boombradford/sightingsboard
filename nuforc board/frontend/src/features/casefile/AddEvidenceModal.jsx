import { useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";

function deriveSuggestions(caseItem) {
  if (!caseItem) return [];
  const text = `${caseItem.report_text || ""} ${caseItem.stats || ""}`.toLowerCase();
  const suggestions = [];

  if (text.includes("streak") || text.includes("seconds") || text.includes("fireball") || text.includes("meteor")) {
    suggestions.push("Meteor / fireball logs");
  }
  if (text.includes("string of lights") || text.includes("starlink") || text.includes("line of lights")) {
    suggestions.push("Starlink pass check");
  }
  if (text.includes("airport") || text.includes("pilot") || text.includes("aircraft")) {
    suggestions.push("Local flight context and NOTAM notes");
  }
  if (!suggestions.length) {
    suggestions.push("Local news context");
    suggestions.push("Astronomy sky conditions");
  }
  return suggestions;
}

export default function AddEvidenceModal({ open, caseItem, onClose, onSubmit }) {
  const suggestions = useMemo(() => deriveSuggestions(caseItem), [caseItem]);
  const [form, setForm] = useState({
    source_title: "",
    source_url: "",
    stance: "contextual",
    match_time: false,
    match_location: false,
    match_visual: false,
    notes: "",
    excerpt: "",
    attachment_path: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <m.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
            aria-label="Close add evidence modal"
          />
          <m.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed inset-0 z-[60] mx-auto my-auto h-fit max-h-[92vh] w-[min(94vw,760px)] overflow-y-auto rounded-2xl border border-slate-500/35 bg-night-950/97 p-4"
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100">Add enrichment evidence</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-500/40 px-2.5 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            </header>

            <div className="mb-3 rounded-xl border border-slate-500/30 bg-slate-900/65 p-3 text-xs text-slate-200">
              <p className="mb-1 uppercase tracking-[0.12em] text-slate-400">Suggested connectors</p>
              <ul className="grid gap-1">
                {suggestions.map((suggestion) => (
                  <li key={suggestion} className="rounded-md border border-slate-500/20 bg-slate-950/60 px-2 py-1">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300 md:col-span-2">
                Source title
                <input
                  value={form.source_title}
                  onChange={(event) => setField("source_title", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300 md:col-span-2">
                Source URL
                <input
                  value={form.source_url}
                  placeholder="https://..."
                  onChange={(event) => setField("source_url", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                Stance
                <select
                  value={form.stance}
                  onChange={(event) => setField("stance", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                >
                  <option value="supports">Supports</option>
                  <option value="contradicts">Contradicts</option>
                  <option value="contextual">Contextual</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                Attachment path
                <input
                  value={form.attachment_path}
                  onChange={(event) => setField("attachment_path", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>

              <div className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300 md:col-span-2">
                Match factors
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-900/60 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.match_time}
                      onChange={(event) => setField("match_time", event.target.checked)}
                      className="h-4 w-4"
                    />
                    Time match
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-900/60 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.match_location}
                      onChange={(event) => setField("match_location", event.target.checked)}
                      className="h-4 w-4"
                    />
                    Location match
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-900/60 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-200">
                    <input
                      type="checkbox"
                      checked={form.match_visual}
                      onChange={(event) => setField("match_visual", event.target.checked)}
                      className="h-4 w-4"
                    />
                    Visual match
                  </label>
                </div>
              </div>

              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300 md:col-span-2">
                Why linked (required)
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300 md:col-span-2">
                Quoted excerpt (optional)
                <textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(event) => setField("excerpt", event.target.value)}
                  className="rounded-lg border border-slate-500/40 bg-slate-950/75 px-2.5 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await onSubmit(form);
                    onClose();
                  } catch (err) {
                    setError(err?.message || "Could not add evidence.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Link evidence"}
              </button>
            </div>
          </m.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
