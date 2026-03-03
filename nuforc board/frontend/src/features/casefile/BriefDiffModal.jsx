import { AnimatePresence, m } from "framer-motion";

export default function BriefDiffModal({ diff, onClose }) {
  return (
    <AnimatePresence>
      {diff ? (
        <>
          <m.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60"
            aria-label="Close brief diff"
          />
          <m.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            className="fixed inset-0 z-[60] mx-auto my-auto h-fit max-h-[90vh] w-[min(94vw,860px)] overflow-y-auto rounded-2xl border border-slate-500/35 bg-night-950/97 p-4"
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-100">Brief version diff</h3>
              <button type="button" onClick={onClose} className="rounded-full border border-slate-500/35 px-2.5 py-1 text-xs text-slate-200">
                Close
              </button>
            </header>
            <p className="text-xs text-slate-300">
              v{diff.left?.version_num} ({diff.left?.generated_at}) vs v{diff.right?.version_num} ({diff.right?.generated_at})
            </p>
            <ul className="mt-3 grid gap-2">
              {(diff.changes || []).map((change) => (
                <li key={change.key} className="rounded-xl border border-slate-500/35 bg-slate-950/70 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200">{change.key}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <pre className="overflow-x-auto rounded-lg border border-slate-500/25 bg-slate-900/60 p-2 text-[11px] text-slate-300">
                      {JSON.stringify(change.left, null, 2)}
                    </pre>
                    <pre className="overflow-x-auto rounded-lg border border-slate-500/25 bg-slate-900/60 p-2 text-[11px] text-slate-300">
                      {JSON.stringify(change.right, null, 2)}
                    </pre>
                  </div>
                </li>
              ))}
            </ul>
          </m.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
