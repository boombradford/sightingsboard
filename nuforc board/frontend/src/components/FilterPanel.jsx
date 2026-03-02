import { m } from "framer-motion";
import { buttonMotion } from "../lib/animations";

export default function FilterPanel({
  draftFilters,
  options,
  loading,
  onInputChange,
  onSubmit,
  onRandomize,
  onReset,
}) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Search Controls</h2>
        <p className="text-sm text-slate-400">Dial in your slice of the record.</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <label className="grid gap-1 text-xs font-medium text-slate-300 sm:col-span-2">
          Keyword
          <input
            type="text"
            name="keyword"
            value={draftFilters.keyword}
            onChange={onInputChange}
            placeholder="orb, triangle, light..."
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          State
          <select
            name="state"
            value={draftFilters.state}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          >
            <option value="">All states</option>
            {options.states.map((stateCode) => (
              <option key={stateCode} value={stateCode}>
                {stateCode}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Shape
          <select
            name="shape"
            value={draftFilters.shape}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          >
            <option value="">All shapes</option>
            {options.shapes.map((shape) => (
              <option key={shape} value={shape}>
                {shape}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          From date
          <input
            type="date"
            name="from_date"
            value={draftFilters.from_date}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          To date
          <input
            type="date"
            name="to_date"
            value={draftFilters.to_date}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Order
          <select
            name="order"
            value={draftFilters.order}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="random">Random mix</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Page size
          <select
            name="limit"
            value={draftFilters.limit}
            onChange={onInputChange}
            className="rounded-lg border border-slate-500/40 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-300/70"
          >
            <option value="20">20</option>
            <option value="40">40</option>
            <option value="80">80</option>
            <option value="120">120</option>
          </select>
        </label>

        <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
          <m.button
            type="submit"
            {...buttonMotion}
            disabled={loading}
            className="rounded-full border border-emerald-300/30 bg-gradient-to-r from-emerald-700/90 to-teal-700/90 px-4 py-2 text-sm font-semibold text-emerald-50 disabled:opacity-60"
          >
            Apply filters
          </m.button>
          <m.button
            type="button"
            {...buttonMotion}
            onClick={onRandomize}
            disabled={loading}
            className="rounded-full border border-slate-400/45 bg-slate-900/85 px-4 py-2 text-sm text-slate-100 disabled:opacity-60"
          >
            Random sample
          </m.button>
          <m.button
            type="button"
            {...buttonMotion}
            onClick={onReset}
            disabled={loading}
            className="rounded-full border border-slate-400/45 bg-slate-900/85 px-4 py-2 text-sm text-slate-100 disabled:opacity-60"
          >
            Reset
          </m.button>
        </div>
      </form>
    </section>
  );
}
