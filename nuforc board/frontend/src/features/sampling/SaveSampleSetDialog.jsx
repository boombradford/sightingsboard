import { useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function SaveSampleSetDialog({ onSave, shareId }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
      <label className="block">
        <span className="text-micro text-slate-500">Save as</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Triangle Midwest 2004-2012"
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200"
        />
      </label>
      <m.button
        type="button"
        whileTap={{ scale: 0.96, transition: springs.snappy }}
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setStatus("");
          try {
            const saved = await onSave(name.trim());
            setStatus(`Saved. Share ID: ${saved.set_id}`);
            setName("");
          } catch (err) {
            setStatus(err?.message || "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
        className="btn-primary w-full justify-center disabled:opacity-40"
      >
        {busy ? "Saving..." : "Save sample set"}
      </m.button>
      {status && <p className="text-caption text-slate-300">{status}</p>}
      {shareId && <p className="text-micro font-mono text-slate-500">Active: {shareId}</p>}
    </div>
  );
}
