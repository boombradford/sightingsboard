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

  return (
    <Modal open={open} onClose={onClose} title="Add enrichment evidence" width="max-w-2xl">
      {/* Suggestions */}
      <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
        <p className="mb-1.5 font-mono text-micro uppercase tracking-wider text-zinc-500">Suggested connectors</p>
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <span key={s} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-micro text-zinc-300">
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="form-label">Source title</span>
          <input value={form.source_title} onChange={(e) => setField("source_title", e.target.value)} className="input-base" />
        </label>

        <label className="block md:col-span-2">
          <span className="form-label">Source URL</span>
          <input value={form.source_url} placeholder="https://..." onChange={(e) => setField("source_url", e.target.value)} className="input-base" />
        </label>

        <label className="block">
          <span className="form-label">Stance</span>
          <select value={form.stance} onChange={(e) => setField("stance", e.target.value)} className="input-base select-styled">
            <option value="supports">Supports</option>
            <option value="contradicts">Contradicts</option>
            <option value="contextual">Contextual</option>
          </select>
        </label>

        <label className="block">
          <span className="form-label">Attachment path</span>
          <input value={form.attachment_path} onChange={(e) => setField("attachment_path", e.target.value)} className="input-base" />
        </label>

        <div className="md:col-span-2">
          <p className="form-label">Match factors</p>
          <div className="flex gap-2">
            {[
              { key: "match_time", label: "Time" },
              { key: "match_location", label: "Location" },
              { key: "match_visual", label: "Visual" },
            ].map(({ key, label }) => (
              <label key={key} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-caption text-zinc-200">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setField(key, e.target.checked)}
                  className="checkbox-accent"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <label className="block md:col-span-2">
          <span className="form-label">Why linked (required)</span>
          <textarea rows={3} value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="input-base" />
        </label>

        <label className="block md:col-span-2">
          <span className="form-label">Quoted excerpt (optional)</span>
          <textarea rows={2} value={form.excerpt} onChange={(e) => setField("excerpt", e.target.value)} className="input-base" />
        </label>
      </div>

      {error && <p className="mt-2 text-caption text-red-400">{error}</p>}

      <div className="mt-4 flex justify-end">
        <m.button
          type="button"
          disabled={busy}
          whileTap={{ scale: 0.97, transition: springs.snappy }}
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
