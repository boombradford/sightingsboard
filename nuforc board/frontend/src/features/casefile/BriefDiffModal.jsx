import Modal from "../shared/Modal";

export default function BriefDiffModal({ diff, onClose }) {
  return (
    <Modal open={!!diff} onClose={onClose} title="Brief version diff" width="max-w-3xl">
      {diff && (
        <>
          <p className="mb-3 font-mono text-caption text-zinc-400">
            v{diff.left?.version_num} ({diff.left?.generated_at}) vs v{diff.right?.version_num} ({diff.right?.generated_at})
          </p>
          <ul className="space-y-2">
            {(diff.changes || []).map((change) => (
              <li key={change.key} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="mb-2 font-mono text-caption font-medium text-zinc-200">{change.key}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-red-500/10 bg-red-950/15 p-2">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      <span className="font-mono text-micro font-medium text-red-400/80">Before</span>
                    </div>
                    <pre className="overflow-x-auto font-mono text-micro text-zinc-300">
                      {JSON.stringify(change.left, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-md border border-green-500/10 bg-green-950/15 p-2">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <span className="font-mono text-micro font-medium text-green-400/80">After</span>
                    </div>
                    <pre className="overflow-x-auto font-mono text-micro text-zinc-300">
                      {JSON.stringify(change.right, null, 2)}
                    </pre>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
