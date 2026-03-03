import { useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import SampleSetCard from "./SampleSetCard";
import SampleSetPanel from "./SampleSetPanel";
import SaveSampleSetDialog from "./SaveSampleSetDialog";
import { iosSprings } from "../../lib/iosMotion";

const SIZES = [5, 10, 25];

export default function SamplingDrawer({
  open,
  onClose,
  config,
  onConfig,
  onGenerate,
  sampleResult,
  onSave,
  sampleSets,
  onOpenSet,
  activeSetId,
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const cards = useMemo(() => (Array.isArray(sampleResult?.items) ? sampleResult.items : []), [sampleResult]);

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <>
          <m.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55"
            aria-label="Close sampling drawer"
          />

          <m.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={iosSprings.sheet}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col border-l border-slate-500/35 bg-night-950/96 p-4"
          >
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100">Sample cases</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-500/40 px-2.5 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            </header>

            <div className="space-y-3 overflow-y-auto pr-1">
              <section className="glass-card space-y-2 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Sample size</p>
                <div className="flex gap-2">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onConfig({ size })}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        config.size === size
                          ? "border-cyan-300/70 bg-cyan-500/15 text-cyan-100"
                          : "border-slate-500/35 bg-slate-900/70 text-slate-200"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                  Strategy
                  <select
                    value={config.strategy}
                    onChange={(event) => onConfig({ strategy: event.target.value })}
                    className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
                  >
                    <option value="uniform">Uniform random</option>
                    <option value="stratified">Stratified</option>
                    <option value="rarity_weighted">Weighted by rarity</option>
                  </select>
                </label>

                {config.strategy !== "uniform" ? (
                  <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
                    Stratify by
                    <select
                      value={config.stratifyBy}
                      onChange={(event) => onConfig({ stratifyBy: event.target.value })}
                      className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
                    >
                      <option value="shape">Shape</option>
                      <option value="decade">Decade</option>
                    </select>
                  </label>
                ) : null}

                <div className="grid gap-1">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={config.hasCoordinates}
                      onChange={(event) => onConfig({ hasCoordinates: event.target.checked })}
                      className="h-4 w-4"
                    />
                    Only with coordinates
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={config.hasSources}
                      onChange={(event) => onConfig({ hasSources: event.target.checked })}
                      className="h-4 w-4"
                    />
                    Only with sources
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={config.hasMedia}
                      onChange={(event) => onConfig({ hasMedia: event.target.checked })}
                      className="h-4 w-4"
                    />
                    Only with media marker
                  </label>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setStatus("");
                    try {
                      const result = await onGenerate();
                      setStatus(
                        `${result.meta.returned}/${result.meta.requested} sampled (${result.meta.strategy}).`
                      );
                    } catch (err) {
                      setStatus(err?.message || "Sampling failed.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-50"
                >
                  {busy ? "Sampling..." : "Sample cases"}
                </button>
                {status ? <p className="text-xs text-slate-200">{status}</p> : null}
              </section>

              <section className="grid gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Sample output</p>
                {cards.length ? cards.map((item) => <SampleSetCard key={item.sighting_id} item={item} />) : <p className="text-xs text-slate-400">No generated sample yet.</p>}
              </section>

              <SaveSampleSetDialog onSave={onSave} shareId={activeSetId} />

              <section className="grid gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Recent sample sets</p>
                <SampleSetPanel sampleSets={sampleSets} activeSetId={activeSetId} onOpenSet={onOpenSet} />
              </section>
            </div>
          </m.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
