import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs, chipBounce } from "../../lib/motion";
import FilterPopover from "./FilterPopover";
import SparkLine from "../visualizations/SparkLine";

const DATE_PRESETS = [
  { label: "12 mo", years: 1 },
  { label: "5 yr", years: 5 },
  { label: "90s", range: ["1990-01-01", "1999-12-31"] },
  { label: "00s", range: ["2000-01-01", "2009-12-31"] },
  { label: "10s", range: ["2010-01-01", "2019-12-31"] },
  { label: "All", range: ["", ""] },
];

function computePresetRange(preset) {
  if (preset.range) return { from: preset.range[0], to: preset.range[1] };
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now);
  start.setFullYear(now.getFullYear() - preset.years);
  return { from: start.toISOString().slice(0, 10), to: end };
}

function FilterChip({ label, value, active, sparkData, onClick, pinned, onTogglePin }) {
  const displayValue = value || "All";
  return (
    <div className="relative">
      <m.button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-caption font-medium transition-colors ${
          active
            ? "border-accent/30 bg-accent-muted text-accent"
            : "border-white/[0.06] bg-white/[0.03] text-slate-300 hover:border-white/[0.10] hover:text-slate-100"
        }`}
        {...chipBounce}
      >
        <span className="text-micro text-slate-500">{label}</span>
        <span className="max-w-[80px] truncate">{displayValue}</span>
        {sparkData && sparkData.length > 2 && (
          <SparkLine data={sparkData} width={40} height={14} />
        )}
        {pinned && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" title="Pinned" />
        )}
      </m.button>
    </div>
  );
}

export default function PivotFilterBar({ state, options, pivot, onPivotChange, onTogglePin, onUpdateSlice }) {
  const [openPopover, setOpenPopover] = useState(null);

  const topShapes = useMemo(() => {
    const fromBins = Array.isArray(pivot.shape_bins)
      ? pivot.shape_bins.map((b) => String(b.shape || b.key || "").trim()).filter(Boolean)
      : [];
    const fromOpts = Array.isArray(options.shapes) ? options.shapes : [];
    return [...new Set([...fromBins, ...fromOpts])].slice(0, 10);
  }, [pivot.shape_bins, options.shapes]);

  const stateOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...(Array.isArray(options?.states) ? options.states : []),
        ...(pivot.state_bins || []).map((b) => b.state),
      ])
    ).filter(Boolean);
  }, [options?.states, pivot.state_bins]);

  const cityOptions = useMemo(() => {
    return Array.from(new Set((pivot.city_bins || []).map((b) => b.city))).filter(Boolean);
  }, [pivot.city_bins]);

  const shapeSpark = useMemo(() => (pivot.shape_bins || []).slice(0, 10).map((b) => b.count || 0), [pivot.shape_bins]);
  const placeSpark = useMemo(() => (pivot.state_bins || []).slice(0, 10).map((b) => b.count || 0), [pivot.state_bins]);
  const dateSpark = useMemo(() => (pivot.date_bins || []).slice(0, 10).map((b) => b.count || 0), [pivot.date_bins]);

  const dateLabel = state.pivot.from_date || state.pivot.to_date
    ? `${state.pivot.from_date || "..."} - ${state.pivot.to_date || "..."}`
    : "";

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {/* Shape chip */}
      <div className="relative">
        <FilterChip
          label="Shape"
          value={state.pivot.shape}
          active={!!state.pivot.shape}
          sparkData={shapeSpark}
          pinned={state.pin.includes("shape")}
          onClick={() => setOpenPopover(openPopover === "shape" ? null : "shape")}
        />
        <FilterPopover
          open={openPopover === "shape"}
          onClose={() => setOpenPopover(null)}
          title="Filter by shape"
        >
          <div className="flex flex-wrap gap-1.5 mb-3">
            <m.button
              type="button"
              onClick={() => { onPivotChange("shape", ""); setOpenPopover(null); }}
              className={`rounded-lg border px-2 py-1 text-micro ${
                !state.pivot.shape ? "border-accent/40 bg-accent-muted text-accent" : "border-white/[0.08] text-slate-300"
              }`}
              whileTap={{ scale: 0.95 }}
            >All</m.button>
            {topShapes.map((s) => (
              <m.button
                key={s}
                type="button"
                onClick={() => { onPivotChange("shape", s); setOpenPopover(null); }}
                className={`rounded-lg border px-2 py-1 text-micro ${
                  state.pivot.shape === s ? "border-accent/40 bg-accent-muted text-accent" : "border-white/[0.08] text-slate-300"
                }`}
                whileTap={{ scale: 0.95 }}
              >{s}</m.button>
            ))}
          </div>
          <select
            value={state.pivot.shape}
            onChange={(e) => { onPivotChange("shape", e.target.value); setOpenPopover(null); }}
            className="w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200"
          >
            <option value="">All shapes</option>
            {(Array.isArray(options.shapes) ? options.shapes : []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onTogglePin("shape")}
            className={`mt-2 text-micro ${state.pin.includes("shape") ? "text-accent" : "text-slate-500"}`}
          >
            {state.pin.includes("shape") ? "Unpin" : "Pin lane"}
          </button>
        </FilterPopover>
      </div>

      {/* Place chip */}
      <div className="relative">
        <FilterChip
          label="Place"
          value={state.pivot.state ? `${state.pivot.state}${state.pivot.city ? ` / ${state.pivot.city}` : ""}` : ""}
          active={!!state.pivot.state}
          sparkData={placeSpark}
          pinned={state.pin.includes("place")}
          onClick={() => setOpenPopover(openPopover === "place" ? null : "place")}
        />
        <FilterPopover
          open={openPopover === "place"}
          onClose={() => setOpenPopover(null)}
          title="Filter by location"
        >
          <div className="space-y-2">
            <label className="block">
              <span className="text-micro text-slate-500">State</span>
              <select
                value={state.pivot.state}
                onChange={(e) => onPivotChange("state", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200"
              >
                <option value="">All states</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-micro text-slate-500">City</span>
              <select
                value={state.pivot.city}
                disabled={!state.pivot.state}
                onChange={(e) => onPivotChange("city", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2.5 py-2 text-caption text-slate-200 disabled:opacity-40"
              >
                <option value="">{state.pivot.state ? "All cities" : "Select state"}</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => onTogglePin("place")}
            className={`mt-2 text-micro ${state.pin.includes("place") ? "text-accent" : "text-slate-500"}`}
          >
            {state.pin.includes("place") ? "Unpin" : "Pin lane"}
          </button>
        </FilterPopover>
      </div>

      {/* Date chip */}
      <div className="relative">
        <FilterChip
          label="Date"
          value={dateLabel}
          active={!!state.pivot.from_date || !!state.pivot.to_date}
          sparkData={dateSpark}
          pinned={state.pin.includes("date")}
          onClick={() => setOpenPopover(openPopover === "date" ? null : "date")}
        />
        <FilterPopover
          open={openPopover === "date"}
          onClose={() => setOpenPopover(null)}
          title="Filter by date"
        >
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="block">
              <span className="text-micro text-slate-500">From</span>
              <input
                type="date"
                value={state.pivot.from_date}
                onChange={(e) => onPivotChange("from_date", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2 py-1.5 text-caption text-slate-200"
              />
            </label>
            <label className="block">
              <span className="text-micro text-slate-500">To</span>
              <input
                type="date"
                value={state.pivot.to_date}
                onChange={(e) => onPivotChange("to_date", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-surface-elevated px-2 py-1.5 text-caption text-slate-200"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const r = computePresetRange(p);
                  onPivotChange("from_date", r.from);
                  onPivotChange("to_date", r.to);
                }}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-micro text-slate-400 hover:text-slate-200"
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onTogglePin("date")}
            className={`mt-2 text-micro ${state.pin.includes("date") ? "text-accent" : "text-slate-500"}`}
          >
            {state.pin.includes("date") ? "Unpin" : "Pin lane"}
          </button>
        </FilterPopover>
      </div>

      {/* Update slice */}
      <m.button
        type="button"
        onClick={onUpdateSlice}
        className="ml-auto shrink-0 rounded-lg bg-accent/90 px-3 py-1.5 text-caption font-semibold text-surface-deepest transition hover:bg-accent hover:shadow-glow"
        whileTap={{ scale: 0.96 }}
      >
        Update slice
      </m.button>
    </div>
  );
}
