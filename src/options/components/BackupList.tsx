import { useState } from "react";
import type { BackupSummary } from "@/shared/types";

interface Props {
  backups: BackupSummary[];
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function BackupList({ backups, onRestore, onDelete, busy }: Props) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  if (backups.length === 0) {
    return <p className="muted">还没有备份。开始整理时会自动生成。</p>;
  }

  return (
    <ul className="backup-list">
      {backups.map((b, idx) => (
        <li key={b.id} className="backup-item">
          <div className="backup-info">
            <span className="backup-time">
              {formatTime(b.at)}
              {idx === 0 && <span className="badge badge--latest">最近</span>}
            </span>
            <span className="backup-meta">
              {b.total} 个书签 · ID {b.id}
            </span>
          </div>
          <div className="backup-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={async () => {
                setRestoringId(b.id);
                try {
                  await onRestore(b.id);
                } finally {
                  setRestoringId(null);
                }
              }}
            >
              {restoringId === b.id ? "恢复中..." : "恢复"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--danger-text"
              disabled={busy}
              onClick={() => onDelete(b.id)}
            >
              删除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
