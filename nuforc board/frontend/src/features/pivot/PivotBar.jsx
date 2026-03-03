import { m } from "framer-motion";
import PivotLaneDate from "./PivotLaneDate";
import PivotLanePlace from "./PivotLanePlace";
import PivotLaneShape from "./PivotLaneShape";

export default function PivotBar({ state, options, pivot, onPivotChange, onTogglePin, onUpdateSlice }) {
  return (
    <m.section
      layout
      className="z-30 space-y-3 border-b border-slate-500/25 bg-night-950/92 pb-3 pt-3 backdrop-blur-lg xl:sticky xl:top-0"
    >
      <div className="grid gap-3 xl:grid-cols-3">
        <PivotLaneShape
          options={options.shapes}
          bins={pivot.shape_bins}
          value={state.pivot.shape}
          pinned={state.pin.includes("shape")}
          onChange={(value) => onPivotChange("shape", value)}
          onTogglePin={() => onTogglePin("shape")}
        />

        <PivotLanePlace
          options={options}
          stateBins={pivot.state_bins}
          cityBins={pivot.city_bins}
          stateValue={state.pivot.state}
          cityValue={state.pivot.city}
          pinned={state.pin.includes("place")}
          onStateChange={(value) => onPivotChange("state", value)}
          onCityChange={(value) => onPivotChange("city", value)}
          onTogglePin={() => onTogglePin("place")}
        />

        <PivotLaneDate
          fromDate={state.pivot.from_date}
          toDate={state.pivot.to_date}
          dateBins={pivot.date_bins}
          pinned={state.pin.includes("date")}
          onDateChange={onPivotChange}
          onPreset={(range) => {
            onPivotChange("from_date", range.from);
            onPivotChange("to_date", range.to);
          }}
          onTogglePin={() => onTogglePin("date")}
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onUpdateSlice}
          className="rounded-full border border-cyan-300/70 bg-cyan-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"
        >
          Update slice
        </button>
      </div>
    </m.section>
  );
}
