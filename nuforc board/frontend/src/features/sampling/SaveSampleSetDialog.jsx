import { useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function SaveSampleSetDialog({ onSave, shareId }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
      <label className="block">
        <span className="form-label">Save as</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Triangle Midwest 2004-2012"
          className="input-base"
        />
      </label>
      <m.button
        type="button"
        whileTap={{ scale: 0.97, transition: springs.snappy }}
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
      {status && <p className="text-caption text-zinc-200">{status}</p>}
      {shareId && <p className="font-mono text-micro text-zinc-500">Active: {shareId}</p>}
    </div>
  );
}
