import Modal from "../shared/Modal";

export default function BriefDiffModal({ diff, onClose }) {
  return (
    <Modal open={!!diff} onClose={onClose} title="Brief version diff" width="max-w-3xl">
      {diff && (
        <>
          <p className="mb-3 text-caption text-slate-400">
            v{diff.left?.version_num} ({diff.left?.generated_at}) vs v{diff.right?.version_num} ({diff.right?.generated_at})
          </p>
          <ul className="space-y-2">
            {(diff.changes || []).map((change) => (
              <li key={change.key} className="rounded-lg border border-white/[0.04] bg-surface-deepest/50 p-3">
                <p className="mb-2 text-caption font-medium text-slate-200">{change.key}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-surface-deepest p-2 text-micro text-slate-400">
                    {JSON.stringify(change.left, null, 2)}
                  </pre>
                  <pre className="overflow-x-auto rounded-lg border border-white/[0.04] bg-surface-deepest p-2 text-micro text-slate-400">
                    {JSON.stringify(change.right, null, 2)}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
