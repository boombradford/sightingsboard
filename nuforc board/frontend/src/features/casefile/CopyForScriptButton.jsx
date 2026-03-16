import { useState } from "react";
import { m } from "motion/react";
import { springs } from "../../lib/motion";

export default function CopyForScriptButton({ caseItem }) {
  const [copied, setCopied] = useState(false);

  if (!caseItem) return null;

  function handleCopy() {
    const brief = caseItem.latest_brief?.brief || caseItem.ai_brief;
    const bullets = brief?.summary?.synopsis_bullets;

    const lines = [
      `CASE #${caseItem.sighting_id} — ${(caseItem.shape || "Unknown").charAt(0).toUpperCase() + (caseItem.shape || "Unknown").slice(1)}, ${caseItem.city} ${caseItem.state} — ${caseItem.date_time}`,
      `Duration: ${caseItem.duration || "unknown"} | Witnesses: ${caseItem.observer_count ?? "unknown"}`,
      "",
      "WITNESS ACCOUNT:",
      caseItem.report_text || "(no narrative available)",
    ];

    if (bullets && bullets.length > 0) {
      lines.push("", "AI SUMMARY:");
      for (const bullet of bullets) {
        lines.push(`- ${bullet}`);
      }
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <m.button
      type="button"
      onClick={handleCopy}
      whileTap={{ scale: 0.97, transition: springs.snappy }}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-micro font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy for Script
        </>
      )}
    </m.button>
  );
}
