import { useMemo, useState } from "react";

const TABS = ["summary", "signals", "citations"];

function cleanSignalLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BriefTabs({ caseItem, versions, onSignalClick }) {
  const [tab, setTab] = useState("summary");
  const latest = useMemo(() => (Array.isArray(versions) && versions.length ? versions[0] : null), [versions]);
  const brief = latest?.brief || caseItem?.latest_brief?.brief || null;

  return (
    <section className="glass-card space-y-3 p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">AI case brief</h3>
        {latest ? (
          <p className="text-[10px] font-mono text-slate-400">
            v{latest.version_num} | {latest.generated_at}
          </p>
        ) : null}
      </header>

      <div className="inline-flex rounded-full border border-slate-500/35 bg-slate-900/75 p-1">
        {TABS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
                active ? "bg-cyan-500/20 text-cyan-100" : "text-slate-300"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      {!brief ? (
        <p className="text-xs text-slate-400">No AI brief generated for this case yet.</p>
      ) : null}

      {brief && tab === "summary" ? (
        <div className="space-y-2 text-xs text-slate-200">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Synopsis</p>
          <ul className="grid gap-1.5">
            {(brief.summary?.synopsis_bullets || []).slice(0, 7).map((line, index) => (
              <li key={`synopsis-${index}`} className="rounded-lg border border-slate-500/30 bg-slate-900/60 px-2.5 py-1.5">
                {line}
              </li>
            ))}
          </ul>

          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Witness claims</p>
          <ul className="grid gap-1.5">
            {(brief.summary?.witness_claims || []).map((line, index) => (
              <li key={`claim-${index}`} className="rounded-lg border border-slate-500/30 bg-slate-900/60 px-2.5 py-1.5">
                {line}
              </li>
            ))}
          </ul>

          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Conventional hypotheses</p>
          <ul className="grid gap-1.5">
            {(brief.summary?.conventional_hypotheses || []).map((hypothesis, index) => (
              <li key={`hypothesis-${index}`} className="rounded-lg border border-slate-500/30 bg-slate-900/60 px-2.5 py-1.5">
                <p className="font-semibold text-slate-100">{hypothesis.label}</p>
                <p>{hypothesis.why}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {brief && tab === "signals" ? (
        <div className="grid gap-2 text-xs text-slate-200">
          {(brief.signals || []).map((signal, index) => (
            <button
              key={`${signal.key || signal.label || index}`}
              type="button"
              onClick={() => onSignalClick(signal.key)}
              className="rounded-lg border border-slate-500/30 bg-slate-900/60 px-2.5 py-1.5 text-left hover:border-cyan-300/50"
            >
              <p className="font-semibold text-cyan-100">{signal.label || cleanSignalLabel(signal.key)}</p>
              <p>{signal.why}</p>
            </button>
          ))}
        </div>
      ) : null}

      {brief && tab === "citations" ? (
        <ul className="grid gap-2 text-xs text-slate-200">
          {(brief.citations || []).map((citation, index) => (
            <li key={`citation-${index}`} className="rounded-lg border border-slate-500/30 bg-slate-900/60 p-2">
              <p className="font-semibold text-slate-100">{citation.claim}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Fields: {(citation.field_keys || []).join(", ") || "n/a"}
              </p>
              <p className="mt-1">{citation.narrative_excerpt || "No narrative excerpt"}</p>
              {Array.isArray(citation.source_urls) && citation.source_urls.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {citation.source_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-cyan-200 underline-offset-2 hover:underline"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
