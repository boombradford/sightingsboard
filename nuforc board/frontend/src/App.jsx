import { useCallback, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import HeroHeader from "./components/HeroHeader";
import ResultsHeader from "./components/ResultsHeader";
import ResultsGrid from "./components/ResultsGrid";
import SidebarPanels from "./components/SidebarPanels";
import { buttonMotion } from "./lib/animations";
import { cx } from "./lib/format";
import { useMobileDrawer } from "./hooks/useMobileDrawer";
import { useUfoDashboard } from "./hooks/useUfoDashboard";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    draftFilters,
    options,
    stats,
    items,
    meta,
    aiBriefs,
    loading,
    loadingStats,
    loadError,
    queryChips,
    snapshotLine,
    geocodedPct,
    prevDisabled,
    nextDisabled,
    handleInputChange,
    applyDraftFilters,
    randomizeFilters,
    resetFilters,
    prevPage,
    nextPage,
    generateBrief,
  } = useUfoDashboard();

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setMenuOpen((current) => !current);
  }, []);

  const drawerRef = useMobileDrawer({ open: menuOpen, onClose: closeMenu });

  const handleApplyFilters = useCallback(() => {
    applyDraftFilters();
    closeMenu();
  }, [applyDraftFilters, closeMenu]);

  const handleRandomize = useCallback(() => {
    randomizeFilters();
    closeMenu();
  }, [closeMenu, randomizeFilters]);

  const handleReset = useCallback(() => {
    resetFilters();
    closeMenu();
  }, [closeMenu, resetFilters]);

  return (
    <LazyMotion features={domAnimation}>
      <main className="relative z-10 mx-auto w-[min(1520px,calc(100%-1rem))] py-4 sm:w-[min(1520px,calc(100%-2rem))]">
        <HeroHeader menuOpen={menuOpen} onToggleMenu={toggleMenu} />

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
          <SidebarPanels
            className="hidden xl:block xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1"
            draftFilters={draftFilters}
            options={options}
            loading={loading}
            loadingStats={loadingStats}
            stats={stats}
            geocodedPct={geocodedPct}
            snapshotLine={snapshotLine}
            queryChips={queryChips}
            onInputChange={handleInputChange}
            onApplyFilters={handleApplyFilters}
            onRandomize={handleRandomize}
            onReset={handleReset}
          />

          <section className="space-y-4">
            <ResultsHeader meta={meta} />

            {loadError ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-rose-500/35 bg-rose-900/30 px-4 py-3 text-sm text-rose-100"
              >
                {loadError}
              </div>
            ) : null}

            <ResultsGrid
              items={items}
              loading={loading}
              aiBriefs={aiBriefs}
              onGenerateBrief={generateBrief}
            />

            <nav className="flex flex-wrap items-center gap-2" aria-label="Pagination">
              <m.button
                type="button"
                {...buttonMotion}
                onClick={prevPage}
                disabled={prevDisabled}
                className="rounded-full border border-slate-400/45 bg-slate-900/85 px-4 py-2 text-sm text-slate-100 disabled:opacity-60"
              >
                Previous
              </m.button>
              <m.button
                type="button"
                {...buttonMotion}
                onClick={nextPage}
                disabled={nextDisabled}
                className="rounded-full border border-slate-400/45 bg-slate-900/85 px-4 py-2 text-sm text-slate-100 disabled:opacity-60"
              >
                Next
              </m.button>
            </nav>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {menuOpen ? (
          <>
            <m.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeMenu}
              aria-label="Close filter menu"
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm xl:hidden"
            />

            <m.div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ x: "-100%", opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-[min(94vw,420px)] border-r border-slate-500/40 bg-night-950/96 p-4 xl:hidden"
            >
              <SidebarPanels
                id="mobile-filter-drawer"
                drawerRef={drawerRef}
                className={cx("h-full overflow-y-auto pr-1")}
                draftFilters={draftFilters}
                options={options}
                loading={loading}
                loadingStats={loadingStats}
                stats={stats}
                geocodedPct={geocodedPct}
                snapshotLine={snapshotLine}
                queryChips={queryChips}
                onInputChange={handleInputChange}
                onApplyFilters={handleApplyFilters}
                onRandomize={handleRandomize}
                onReset={handleReset}
              />
            </m.div>
          </>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
