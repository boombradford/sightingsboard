import { useState } from "react";
import { m } from "framer-motion";

export default function SaveSampleSetDialog({ onSave, shareId }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  return (
    <div className="grid gap-2 rounded-xl border border-slate-500/35 bg-slate-900/70 p-3">
      <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
        Save as
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Triangle Midwest 2004-2012"
          className="rounded-lg border border-slate-500/40 bg-slate-950/80 px-2.5 py-2 text-sm text-slate-100"
        />
      </label>
      <m.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={!name.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setStatus("");
          try {
            const saved = await onSave(name.trim());
            setStatus(`Saved. Share ID: ${saved.set_id}`);
            setName("");
          } catch (err) {
            setStatus(err?.message || "Could not save sample set.");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save sample set"}
      </m.button>
      {status ? <p className="text-xs text-slate-200">{status}</p> : null}
      {shareId ? <p className="text-[10px] font-mono text-slate-400">Active set: {shareId}</p> : null}
    </div>
  );
}
