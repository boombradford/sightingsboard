import { m } from "framer-motion";
import { cx } from "../lib/format";
import { sectionVariants } from "../lib/animations";
import FilterPanel from "./FilterPanel";
import DatasetPulsePanel from "./DatasetPulsePanel";
import ActiveSlicePanel from "./ActiveSlicePanel";
import SourceLegendPanel from "./SourceLegendPanel";

export default function SidebarPanels({
  className,
  id,
  drawerRef,
  draftFilters,
  options,
  loading,
  loadingStats,
  stats,
  geocodedPct,
  snapshotLine,
  queryChips,
  onInputChange,
  onApplyFilters,
  onRandomize,
  onReset,
}) {
  return (
    <m.aside
      id={id}
      ref={drawerRef}
      tabIndex={-1}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: 0.04 }}
      className={cx("space-y-5", className)}
    >
      <FilterPanel
        draftFilters={draftFilters}
        options={options}
        loading={loading}
        onInputChange={onInputChange}
        onSubmit={onApplyFilters}
        onRandomize={onRandomize}
        onReset={onReset}
      />
      <DatasetPulsePanel loadingStats={loadingStats} stats={stats} geocodedPct={geocodedPct} />
      <ActiveSlicePanel snapshotLine={snapshotLine} queryChips={queryChips} />
      <SourceLegendPanel />
    </m.aside>
  );
}
