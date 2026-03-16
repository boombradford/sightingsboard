import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs, chipBounce } from "../../lib/motion";
import FilterPopover from "./FilterPopover";
import SparkLine from "../visualizations/SparkLine";

const DECADES = [
  { label: "All", from: "", to: "" },
  { label: "1950s", from: "1950-01-01", to: "1959-12-31" },
  { label: "1960s", from: "1960-01-01", to: "1969-12-31" },
  { label: "1970s", from: "1970-01-01", to: "1979-12-31" },
  { label: "1980s", from: "1980-01-01", to: "1989-12-31" },
  { label: "1990s", from: "1990-01-01", to: "1999-12-31" },
  { label: "2000s", from: "2000-01-01", to: "2009-12-31" },
  { label: "2010s", from: "2010-01-01", to: "2019-12-31" },
  { label: "2020s", from: "2020-01-01", to: "2029-12-31" },
];

const PHENOMENA = [
  { key: "abduction", label: "Abduction" },
  { key: "lost_time", label: "Lost Time" },
  { key: "entity", label: "Entity / Humanoid" },
  { key: "paralysis", label: "Paralysis" },
  { key: "telepathy", label: "Telepathy" },
  { key: "physical_effects", label: "Physical Effects" },
  { key: "em_effects", label: "EM Effects" },
];

function yearsForDecade(decadeLabel) {
  const match = decadeLabel.match(/^(\d{4})s$/);
  if (!match) return [];
  const start = Number(match[1]);
  return Array.from({ length: 10 }, (_, i) => start + i);
}

function FilterChip({ label, value, active, sparkData, onClick, pinned }) {
  const displayValue = value || "All";
  return (
    <div className="relative">
      <m.button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-caption font-medium transition-colors ${
          active
            ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-400"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600 hover:text-zinc-100"
        }`}
        {...chipBounce}
      >
        <span className="font-mono text-micro uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="max-w-[80px] truncate">{displayValue}</span>
        {sparkData && sparkData.length > 2 && (
          <SparkLine data={sparkData} width={40} height={14} />
        )}
        {pinned && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title="Pinned" />
        )}
      </m.button>
    </div>
  );
}

export default function PivotFilterBar({ state, options, pivot, onPivotChange, onTogglePin, onUpdateSlice, onSignalFilter }) {
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

  // Detect which decade is active based on current from/to dates
  const activeDecade = useMemo(() => {
    const d = DECADES.find((d) => d.from && d.from === state.pivot.from_date && d.to === state.pivot.to_date);
    return d ? d.label : "";
  }, [state.pivot.from_date, state.pivot.to_date]);

  // Detect if a single year is selected within the active decade
  const activeYear = useMemo(() => {
    if (!state.pivot.from_date || !state.pivot.to_date) return "";
    const fromMatch = state.pivot.from_date.match(/^(\d{4})-01-01$/);
    const toMatch = state.pivot.to_date.match(/^(\d{4})-12-31$/);
    if (fromMatch && toMatch && fromMatch[1] === toMatch[1]) return fromMatch[1];
    return "";
  }, [state.pivot.from_date, state.pivot.to_date]);

  const phenomenaLabel = useMemo(() => {
    const match = PHENOMENA.find((p) => p.key === state.signal);
    return match ? match.label : "";
  }, [state.signal]);

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
              className={`rounded-md border px-2 py-1 text-micro font-medium ${
                !state.pivot.shape ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400" : "border-zinc-700 text-zinc-300"
              }`}
              whileTap={{ scale: 0.96 }}
            >All</m.button>
            {topShapes.map((s) => (
              <m.button
                key={s}
                type="button"
                onClick={() => { onPivotChange("shape", s); setOpenPopover(null); }}
                className={`rounded-md border px-2 py-1 text-micro font-medium ${
                  state.pivot.shape === s ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400" : "border-zinc-700 text-zinc-300"
                }`}
                whileTap={{ scale: 0.96 }}
              >{s}</m.button>
            ))}
          </div>
          <select
            value={state.pivot.shape}
            onChange={(e) => { onPivotChange("shape", e.target.value); setOpenPopover(null); }}
            className="input-base select-styled"
          >
            <option value="">All shapes</option>
            {(Array.isArray(options.shapes) ? options.shapes : []).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onTogglePin("shape")}
            className={`mt-2 text-micro font-medium ${state.pin.includes("shape") ? "text-amber-400" : "text-zinc-400 hover:text-zinc-300"}`}
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
              <span className="form-label">State</span>
              <select
                value={state.pivot.state}
                onChange={(e) => onPivotChange("state", e.target.value)}
                className="input-base select-styled"
              >
                <option value="">All states</option>
                {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="form-label">City</span>
              <select
                value={state.pivot.city}
                disabled={!state.pivot.state}
                onChange={(e) => onPivotChange("city", e.target.value)}
                className="input-base select-styled disabled:opacity-40"
              >
                <option value="">{state.pivot.state ? "All cities" : "Select state"}</option>
                {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => onTogglePin("place")}
            className={`mt-2 text-micro font-medium ${state.pin.includes("place") ? "text-amber-400" : "text-zinc-400 hover:text-zinc-300"}`}
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
          <div className="space-y-3">
            {/* Decade dropdown */}
            <label className="block">
              <span className="form-label">Decade</span>
              <select
                value={activeDecade}
                onChange={(e) => {
                  const dec = DECADES.find((d) => d.label === e.target.value);
                  if (dec) {
                    onPivotChange("from_date", dec.from);
                    onPivotChange("to_date", dec.to);
                  }
                }}
                className="input-base select-styled"
              >
                {DECADES.map((d) => (
                  <option key={d.label} value={d.label}>{d.label}</option>
                ))}
              </select>
            </label>

            {/* Year dropdown — populated from selected decade */}
            <label className="block">
              <span className="form-label">Year</span>
              <select
                value={activeYear}
                disabled={!activeDecade || activeDecade === "All"}
                onChange={(e) => {
                  const yr = e.target.value;
                  if (!yr) {
                    // Reset to full decade
                    const dec = DECADES.find((d) => d.label === activeDecade);
                    if (dec) {
                      onPivotChange("from_date", dec.from);
                      onPivotChange("to_date", dec.to);
                    }
                  } else {
                    onPivotChange("from_date", `${yr}-01-01`);
                    onPivotChange("to_date", `${yr}-12-31`);
                  }
                }}
                className="input-base select-styled disabled:opacity-40"
              >
                <option value="">{activeDecade && activeDecade !== "All" ? "All years" : "Select decade"}</option>
                {activeDecade && yearsForDecade(activeDecade).map((yr) => (
                  <option key={yr} value={String(yr)}>{yr}</option>
                ))}
              </select>
            </label>

            {/* Quick actions */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const end = now.toISOString().slice(0, 10);
                  const start = new Date(now);
                  start.setFullYear(now.getFullYear() - 1);
                  onPivotChange("from_date", start.toISOString().slice(0, 10));
                  onPivotChange("to_date", end);
                }}
                className="rounded border border-zinc-700 px-2 py-1 text-micro text-zinc-300 hover:border-zinc-600 hover:text-zinc-200"
              >12 mo</button>
              <button
                type="button"
                onClick={() => {
                  onPivotChange("from_date", "");
                  onPivotChange("to_date", "");
                }}
                className="rounded border border-zinc-700 px-2 py-1 text-micro text-zinc-300 hover:border-zinc-600 hover:text-zinc-200"
              >All</button>
            </div>

            {/* Manual from/to */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="form-label">From</span>
                <input
                  type="date"
                  value={state.pivot.from_date}
                  onChange={(e) => onPivotChange("from_date", e.target.value)}
                  className="input-base"
                />
              </label>
              <label className="block">
                <span className="form-label">To</span>
                <input
                  type="date"
                  value={state.pivot.to_date}
                  onChange={(e) => onPivotChange("to_date", e.target.value)}
                  className="input-base"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTogglePin("date")}
            className={`mt-2 text-micro font-medium ${state.pin.includes("date") ? "text-amber-400" : "text-zinc-400 hover:text-zinc-300"}`}
          >
            {state.pin.includes("date") ? "Unpin" : "Pin lane"}
          </button>
        </FilterPopover>
      </div>

      {/* Phenomena chip */}
      <div className="relative">
        <FilterChip
          label="Phenomena"
          value={phenomenaLabel}
          active={!!state.signal && PHENOMENA.some((p) => p.key === state.signal)}
          onClick={() => setOpenPopover(openPopover === "phenomena" ? null : "phenomena")}
        />
        <FilterPopover
          open={openPopover === "phenomena"}
          onClose={() => setOpenPopover(null)}
          title="High-strangeness phenomena"
        >
          <div className="flex flex-col gap-1">
            <m.button
              type="button"
              onClick={() => { onSignalFilter(""); setOpenPopover(null); }}
              className={`rounded-md border px-2 py-1 text-left text-micro font-medium ${
                !state.signal ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400" : "border-zinc-700 text-zinc-300"
              }`}
              whileTap={{ scale: 0.96 }}
            >All</m.button>
            {PHENOMENA.map((p) => (
              <m.button
                key={p.key}
                type="button"
                onClick={() => { onSignalFilter(p.key); setOpenPopover(null); }}
                className={`rounded-md border px-2 py-1 text-left text-micro font-medium ${
                  state.signal === p.key ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400" : "border-zinc-700 text-zinc-300"
                }`}
                whileTap={{ scale: 0.96 }}
              >{p.label}</m.button>
            ))}
          </div>
        </FilterPopover>
      </div>

      {/* Has description toggle */}
      <m.button
        type="button"
        onClick={() => onPivotChange("has_description", !state.pivot.has_description)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-caption font-medium transition-colors ${
          state.pivot.has_description
            ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-400"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:border-zinc-600 hover:text-zinc-100"
        }`}
        {...chipBounce}
        title="Only show sightings with detailed witness descriptions"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <line x1="4" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="4" y1="7.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <line x1="4" y1="10" x2="7.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span>Has story</span>
      </m.button>

      {/* Update slice */}
      <m.button
        type="button"
        onClick={onUpdateSlice}
        className="btn-primary ml-auto shrink-0"
        whileTap={{ scale: 0.97 }}
      >
        Update slice
      </m.button>
    </div>
  );
}
