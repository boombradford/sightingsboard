import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";
import Drawer from "../shared/Drawer";
import Chip from "../shared/Chip";
import SampleSetCard from "./SampleSetCard";
import SampleSetPanel from "./SampleSetPanel";
import SaveSampleSetDialog from "./SaveSampleSetDialog";

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

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200";

  return (
    <Drawer open={open} onClose={onClose} title="Sample cases">
      <div className="space-y-4">
        {/* Config */}
        <section className="space-y-3">
          <p className="text-micro font-medium text-slate-500">Sample size</p>
          <div className="flex gap-1.5">
            {SIZES.map((size) => (
              <Chip key={size} selected={config.size === size} onClick={() => onConfig({ size })}>
                {size}
              </Chip>
            ))}
          </div>

          <label className="block">
            <span className="text-micro text-slate-500">Strategy</span>
            <select value={config.strategy} onChange={(e) => onConfig({ strategy: e.target.value })} className={inputCls}>
              <option value="uniform">Uniform random</option>
              <option value="stratified">Stratified</option>
              <option value="rarity_weighted">Weighted by rarity</option>
            </select>
          </label>

          {config.strategy !== "uniform" && (
            <label className="block">
              <span className="text-micro text-slate-500">Stratify by</span>
              <select value={config.stratifyBy} onChange={(e) => onConfig({ stratifyBy: e.target.value })} className={inputCls}>
                <option value="shape">Shape</option>
                <option value="decade">Decade</option>
              </select>
            </label>
          )}

          <div className="space-y-1.5">
            {[
              { key: "hasCoordinates", label: "Only with coordinates" },
              { key: "hasSources", label: "Only with sources" },
              { key: "hasMedia", label: "Only with media marker" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-caption text-slate-300">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => onConfig({ [key]: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-accent"
                />
                {label}
              </label>
            ))}
          </div>

          <m.button
            type="button"
            disabled={busy}
            whileTap={{ scale: 0.96, transition: springs.snappy }}
            onClick={async () => {
              setBusy(true);
              setStatus("");
              try {
                const result = await onGenerate();
                setStatus(`${result.meta.returned}/${result.meta.requested} sampled (${result.meta.strategy}).`);
              } catch (err) {
                setStatus(err?.message || "Sampling failed.");
              } finally {
                setBusy(false);
              }
            }}
            className="btn-primary w-full justify-center disabled:opacity-40"
          >
            {busy ? "Sampling..." : "Generate sample"}
          </m.button>
          {status && <p className="text-caption text-slate-300">{status}</p>}
        </section>

        {/* Output */}
        <section className="space-y-2">
          <p className="text-micro font-medium text-slate-500">Sample output</p>
          {cards.length ? (
            cards.map((item) => <SampleSetCard key={item.sighting_id} item={item} />)
          ) : (
            <p className="text-caption text-slate-500">No sample generated yet.</p>
          )}
        </section>

        <SaveSampleSetDialog onSave={onSave} shareId={activeSetId} />

        <section className="space-y-2">
          <p className="text-micro font-medium text-slate-500">Recent sample sets</p>
          <SampleSetPanel sampleSets={sampleSets} activeSetId={activeSetId} onOpenSet={onOpenSet} />
        </section>
      </div>
    </Drawer>
  );
}
