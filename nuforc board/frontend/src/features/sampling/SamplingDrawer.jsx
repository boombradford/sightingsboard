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

  return (
    <Drawer open={open} onClose={onClose} title="Sample cases">
      <div className="space-y-4">
        {/* Configuration section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <h3 className="font-display text-caption font-semibold text-zinc-200">Configuration</h3>
          </div>

          <p className="form-label">Sample size</p>
          <div className="flex gap-1.5">
            {SIZES.map((size) => (
              <Chip key={size} selected={config.size === size} onClick={() => onConfig({ size })}>
                {size}
              </Chip>
            ))}
          </div>

          <label className="block">
            <span className="form-label">Strategy</span>
            <select value={config.strategy} onChange={(e) => onConfig({ strategy: e.target.value })} className="input-base select-styled">
              <option value="uniform">Uniform random</option>
              <option value="stratified">Stratified</option>
              <option value="rarity_weighted">Weighted by rarity</option>
            </select>
          </label>

          {config.strategy !== "uniform" && (
            <label className="block">
              <span className="form-label">Stratify by</span>
              <select value={config.stratifyBy} onChange={(e) => onConfig({ stratifyBy: e.target.value })} className="input-base select-styled">
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
              <label key={key} className="flex items-center gap-2 text-caption text-zinc-200">
                <input
                  type="checkbox"
                  checked={config[key]}
                  onChange={(e) => onConfig({ [key]: e.target.checked })}
                  className="checkbox-accent"
                />
                {label}
              </label>
            ))}
          </div>

          <m.button
            type="button"
            disabled={busy}
            whileTap={{ scale: 0.97, transition: springs.snappy }}
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
          {status && <p className="text-caption text-zinc-200">{status}</p>}
        </section>

        <div className="divider" />

        {/* Sample Output */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <h3 className="font-display text-caption font-semibold text-zinc-200">Sample Output</h3>
          </div>
          {cards.length ? (
            cards.map((item) => <SampleSetCard key={item.sighting_id} item={item} />)
          ) : (
            <p className="text-caption text-zinc-500">No sample generated yet.</p>
          )}
        </section>

        <SaveSampleSetDialog onSave={onSave} shareId={activeSetId} />

        <div className="divider" />

        {/* Recent sample sets */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3 className="font-display text-caption font-semibold text-zinc-200">Recent Sample Sets</h3>
          </div>
          <SampleSetPanel sampleSets={sampleSets} activeSetId={activeSetId} onOpenSet={onOpenSet} />
        </section>
      </div>
    </Drawer>
  );
}
