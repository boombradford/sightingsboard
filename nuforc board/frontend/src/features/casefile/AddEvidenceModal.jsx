import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";
import Modal from "../shared/Modal";

function deriveSuggestions(caseItem) {
  if (!caseItem) return [];
  const text = `${caseItem.report_text || ""} ${caseItem.stats || ""}`.toLowerCase();
  const suggestions = [];
  if (text.includes("streak") || text.includes("seconds") || text.includes("fireball") || text.includes("meteor"))
    suggestions.push("Meteor / fireball logs");
  if (text.includes("string of lights") || text.includes("starlink") || text.includes("line of lights"))
    suggestions.push("Starlink pass check");
  if (text.includes("airport") || text.includes("pilot") || text.includes("aircraft"))
    suggestions.push("Local flight context and NOTAM notes");
  if (!suggestions.length) {
    suggestions.push("Local news context");
    suggestions.push("Astronomy sky conditions");
  }
  return suggestions;
}

export default function AddEvidenceModal({ open, caseItem, onClose, onSubmit }) {
  const suggestions = useMemo(() => deriveSuggestions(caseItem), [caseItem]);
  const [form, setForm] = useState({
    source_title: "", source_url: "", stance: "contextual",
    match_time: false, match_location: false, match_visual: false,
    notes: "", excerpt: "", attachment_path: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setField = (key, value) => setForm((c) => ({ ...c, [key]: value }));
  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200";

  return (
    <Modal open={open} onClose={onClose} title="Add enrichment evidence" width="max-w-2xl">
      {/* Suggestions */}
      <div className="mb-4 rounded-lg border border-white/[0.04] bg-surface-deepest/40 p-3">
        <p className="mb-1.5 text-micro font-medium text-slate-500">Suggested connectors</p>
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <span key={s} className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-micro text-slate-400">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-micro text-slate-500">Source title</span>
          <input value={form.source_title} onChange={(e) => setField("source_title", e.target.value)} className={inputCls} />
        </label>

        <label className="block md:col-span-2">
          <span className="text-micro text-slate-500">Source URL</span>
          <input value={form.source_url} placeholder="https://..." onChange={(e) => setField("source_url", e.target.value)} className={inputCls} />
        </label>

        <label className="block">
          <span className="text-micro text-slate-500">Stance</span>
          <select value={form.stance} onChange={(e) => setField("stance", e.target.value)} className={inputCls}>
            <option value="supports">Supports</option>
            <option value="contradicts">Contradicts</option>
            <option value="contextual">Contextual</option>
          </select>
        </label>

        <label className="block">
          <span className="text-micro text-slate-500">Attachment path</span>
          <input value={form.attachment_path} onChange={(e) => setField("attachment_path", e.target.value)} className={inputCls} />
        </label>

        <div className="md:col-span-2">
          <p className="mb-1.5 text-micro text-slate-500">Match factors</p>
          <div className="flex gap-2">
            {[
              { key: "match_time", label: "Time" },
              { key: "match_location", label: "Location" },
              { key: "match_visual", label: "Visual" },
            ].map(({ key, label }) => (
              <label key={key} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-caption text-slate-300">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setField(key, e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-accent"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="block md:col-span-2">
          <span className="text-micro text-slate-500">Why linked (required)</span>
          <textarea rows={3} value={form.notes} onChange={(e) => setField("notes", e.target.value)} className={inputCls} />
        </label>

        <label className="block md:col-span-2">
          <span className="text-micro text-slate-500">Quoted excerpt (optional)</span>
          <textarea rows={2} value={form.excerpt} onChange={(e) => setField("excerpt", e.target.value)} className={inputCls} />
        </label>
      </div>

      {error && <p className="mt-2 text-caption text-rose-400">{error}</p>}

      <div className="mt-4 flex justify-end">
        <m.button
          type="button"
          disabled={busy}
          whileTap={{ scale: 0.96, transition: springs.snappy }}
          onClick={async () => {
            setBusy(true);
            setError("");
            try { await onSubmit(form); onClose(); }
            catch (err) { setError(err?.message || "Could not add evidence."); }
            finally { setBusy(false); }
          }}
          className="btn-primary disabled:opacity-40"
        >
          {busy ? "Saving..." : "Link evidence"}
        </m.button>
      </div>
    </Modal>
  );
}
