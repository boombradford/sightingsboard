export default function MiniHistogram({ bins, selectedKey, keyField = "key" }) {
  const safeBins = Array.isArray(bins) ? bins.slice(0, 14) : [];
  const maxCount = safeBins.reduce((acc, bin) => Math.max(acc, Number(bin.count || 0)), 1);

  return (
    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5" role="presentation">
      {safeBins.map((bin, index) => {
        const key = String(bin[keyField] ?? bin.key ?? index);
        const count = Number(bin.count || 0);
        const height = Math.max(8, Math.round((count / maxCount) * 46));
        const active = selectedKey && selectedKey.toLowerCase() === key.toLowerCase();
        return (
          <div key={`${key}-${index}`} className="flex flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-sm ${active ? "bg-cyan-300" : "bg-slate-500/50"}`}
              style={{ height: `${height}px` }}
              title={`${key}: ${count}`}
            />
          </div>
        );
      })}
    </div>
  );
}
