import { useMemo, useState } from "react";
import { m } from "motion/react";
import { springs, stagger } from "../../lib/motion";

const TABS = ["summary", "signals", "citations"];

function cleanSignalLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BriefTabs({ caseItem, versions, onSignalClick }) {
  const [tab, setTab] = useState("summary");
  const latest = useMemo(() => (Array.isArray(versions) && versions.length ? versions[0] : null), [versions]);
  const brief = latest?.brief || caseItem?.latest_brief?.brief || null;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-caption font-semibold text-slate-200">AI Brief</h3>
        {latest && (
          <span className="text-micro font-mono text-slate-500">
            v{latest.version_num} &middot; {latest.generated_at}
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="relative inline-flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
        {TABS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative z-10 rounded-md px-2.5 py-1 text-micro font-medium transition-colors capitalize ${
                active ? "text-surface-deepest" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {active && (
                <m.div
                  className="absolute inset-0 rounded-md bg-accent"
                  layoutId="brief-tab"
                  transition={springs.snappy}
                />
              )}
              <span className="relative">{key}</span>
            </button>
          );
        })}
      </div>

      {!brief && (
        <p className="text-caption text-slate-500">No AI brief generated yet.</p>
      )}

      {brief && tab === "summary" && (
        <div className="space-y-3">
          {[
            { label: "Synopsis", items: brief.summary?.synopsis_bullets },
            { label: "Witness claims", items: brief.summary?.witness_claims },
          ].map(({ label, items: bulletItems }) =>
            bulletItems?.length ? (
              <div key={label}>
                <p className="mb-1.5 text-micro font-medium text-slate-500">{label}</p>
                <ul className="space-y-1">
                  {bulletItems.slice(0, 7).map((line, i) => (
                    <m.li
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...springs.smooth, delay: stagger(i) }}
                      className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 px-3 py-2 text-caption text-slate-300"
                    >
                      {line}
                    </m.li>
                  ))}
                </ul>
              </div>
            ) : null
          )}

          {brief.summary?.conventional_hypotheses?.length ? (
            <div>
              <p className="mb-1.5 text-micro font-medium text-slate-500">Hypotheses</p>
              <ul className="space-y-1">
                {brief.summary.conventional_hypotheses.map((h, i) => (
                  <li key={i} className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 px-3 py-2">
                    <p className="text-caption font-medium text-slate-200">{h.label}</p>
                    <p className="text-micro text-slate-400 mt-0.5">{h.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {brief && tab === "signals" && (
        <div className="space-y-1">
          {(brief.signals || []).map((signal, i) => (
            <m.button
              key={signal.key || signal.label || i}
              type="button"
              onClick={() => onSignalClick(signal.key)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.smooth, delay: stagger(i) }}
              className="w-full rounded-lg border border-white/[0.04] bg-surface-deepest/50 px-3 py-2 text-left transition-colors hover:border-accent/20"
            >
              <p className="text-caption font-medium text-accent">{signal.label || cleanSignalLabel(signal.key)}</p>
              <p className="text-micro text-slate-400 mt-0.5">{signal.why}</p>
            </m.button>
          ))}
        </div>
      )}

      {brief && tab === "citations" && (
        <ul className="space-y-1">
          {(brief.citations || []).map((cit, i) => (
            <li key={i} className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 p-3">
              <p className="text-caption font-medium text-slate-200">{cit.claim}</p>
              <p className="mt-1 text-micro text-slate-500">
                Fields: {(cit.field_keys || []).join(", ") || "n/a"}
              </p>
              <p className="mt-1 text-micro text-slate-400">{cit.narrative_excerpt || "No excerpt"}</p>
              {Array.isArray(cit.source_urls) && cit.source_urls.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {cit.source_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-micro text-accent/80 hover:text-accent underline-offset-2 hover:underline"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
