import MiniHistogram from "./MiniHistogram";
import PinToggle from "./PinToggle";

export default function PivotLanePlace({
  options,
  stateBins,
  cityBins,
  stateValue,
  cityValue,
  pinned,
  onStateChange,
  onCityChange,
  onTogglePin,
}) {
  const stateOptions = Array.from(
    new Set([...(Array.isArray(options?.states) ? options.states : []), ...(stateBins || []).map((bin) => bin.state)])
  ).filter(Boolean);

  const cityOptions = Array.from(new Set((cityBins || []).map((bin) => bin.city))).filter(Boolean);

  return (
    <section className="glass-card flex min-w-0 flex-col gap-2 p-3" aria-label="Place pivot lane">
      <div className="flex items-center justify-between gap-2">
        <h3 className="panel-title">Place</h3>
        <PinToggle pinned={pinned} onToggle={onTogglePin} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          State
          <select
            value={stateValue}
            onChange={(event) => onStateChange(event.target.value)}
            className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100"
          >
            <option value="">All states</option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.14em] text-slate-300">
          City
          <select
            value={cityValue}
            disabled={!stateValue}
            onChange={(event) => onCityChange(event.target.value)}
            className="rounded-lg border border-slate-500/40 bg-slate-900/70 px-2.5 py-2 text-sm text-slate-100 disabled:opacity-45"
          >
            <option value="">{stateValue ? "All cities" : "Select state first"}</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </div>

      <MiniHistogram bins={stateValue ? cityBins : stateBins} selectedKey={stateValue ? cityValue : stateValue} keyField={stateValue ? "city" : "state"} />
    </section>
  );
}
