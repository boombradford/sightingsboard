import { safeText } from "../lib/format";

export default function AiBriefBlock({ title, content }) {
  return (
    <div className="rounded-lg border border-slate-500/35 bg-slate-950/70 p-2.5">
      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-200">{title}</h5>
      {Array.isArray(content) ? (
        <ul className="grid gap-1 pl-4 text-xs text-slate-300">
          {content.length ? (
            content.map((item, index) => {
              if (item && typeof item === "object") {
                const label = safeText(item.label, "hypothesis");
                const why = safeText(item.why, "");
                const conf =
                  item.confidence_0_to_1 == null
                    ? "n/a"
                    : Number(item.confidence_0_to_1).toFixed(2);
                return (
                  <li key={`${title}-${label}-${index}`}>{`${label}: ${why} (confidence ${conf})`}</li>
                );
              }
              return <li key={`${title}-${index}`}>{safeText(item, "")}</li>;
            })
          ) : (
            <li>No items.</li>
          )}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-slate-300">{safeText(content, "No summary.")}</p>
      )}
    </div>
  );
}
