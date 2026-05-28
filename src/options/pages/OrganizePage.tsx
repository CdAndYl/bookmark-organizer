import { useCallback, useEffect, useState } from "react";
import { useBackground } from "../hooks/useBackground";
import { BookmarkPreview } from "../components/BookmarkPreview";
import { BackupList } from "../components/BackupList";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBar } from "../components/StatusBar";
import type { OrganizeMode } from "@/core/messaging/protocol";
import type { OrganizeResult, PreviewSnapshot, RestoreResult } from "@/shared/types";

const MODE_OPTIONS: { value: OrganizeMode; label: string }[] = [
  { value: "smart", label: "智能整理" },
  { value: "domain", label: "按域名分组" },
];

export function OrganizePage() {
  const send = useBackground();
  const [mode, setMode] = useState<OrganizeMode>("smart");
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<OrganizeResult | RestoreResult | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await send({ command: "get-preview", mode });
      setSnapshot(next);
      setLastResult(next.lastResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [send, mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runOrganize() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const result = await send({ command: "organize-now", mode });
      setLastResult(result);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await send({ command: "restore-backup", backupId: id });
      setLastResult(result);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await send({ command: "delete-backup", backupId: id });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>正在读取书签...</p>;
  if (!snapshot) return <StatusBar kind="error">无法加载书签数据</StatusBar>;

  const lastLabel = renderLastResult(lastResult);

  return (
    <div className="organize-page">
      {error && <StatusBar kind="error">{error}</StatusBar>}

      <section className="section">
        <header className="section-header">
          <h2>整理预览</h2>
          <div className="section-actions">
            <div className="mode-switch" role="group" aria-label="整理模式">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`btn ${mode === opt.value ? "btn--primary" : "btn--ghost"}`}
                  aria-pressed={mode === opt.value}
                  disabled={busy}
                  onClick={() => setMode(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={refresh}
            >
              刷新
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || snapshot.total === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {busy ? "处理中..." : "开始整理"}
            </button>
          </div>
        </header>
        {mode === "domain" ? (
          <p className="muted">
            共 {snapshot.total} 个书签 · 将按域名分到{" "}
            {Object.keys(snapshot.categoryCounts).length} 个文件夹（零散域名归入「其他」）
          </p>
        ) : (
          <p className="muted">
            共 {snapshot.total} 个书签 · 规则命中 {snapshot.sourceCounts.rule} ·
            AI 命中 {snapshot.sourceCounts.ai} · AI:
            {snapshot.ai.enabled ? `${snapshot.ai.mode}/${snapshot.ai.model}` : "关闭"}
          </p>
        )}
        {snapshot.status === "already-organized" && (
          <StatusBar kind="success">书签栏已是整理后的结构。</StatusBar>
        )}
        <BookmarkPreview snapshot={snapshot} />
      </section>

      <section className="section">
        <header className="section-header">
          <h2>备份历史</h2>
          <span className="muted">最多保留 5 份</span>
        </header>
        <BackupList
          backups={snapshot.backups}
          onRestore={handleRestore}
          onDelete={handleDelete}
          busy={busy}
        />
      </section>

      {lastLabel && (
        <section className="section">
          <h2>上次操作</h2>
          <pre className="result-pre">{lastLabel}</pre>
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="确认整理书签"
        message={
          mode === "domain" ? (
            <>
              <p>
                将按域名把 <b>{snapshot.total}</b> 个书签分组到{" "}
                {Object.keys(snapshot.categoryCounts).length} 个域名文件夹，零散域名归入「其他」。
              </p>
              <p>操作前会自动备份,你可以随时从"备份历史"恢复。</p>
            </>
          ) : (
            <>
              <p>
                将根据规则把 <b>{snapshot.total}</b> 个书签重新分类到 {Object.keys(snapshot.categoryCounts).length} 个目录。
              </p>
              <p>
                操作前会自动备份,你可以随时从"备份历史"恢复。AI 配置:
                {snapshot.ai.enabled
                  ? `已开启(${snapshot.ai.mode}, ${snapshot.ai.model})`
                  : "关闭"}。
              </p>
            </>
          )
        }
        confirmLabel="开始整理"
        onConfirm={runOrganize}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function renderLastResult(result: OrganizeResult | RestoreResult | null): string | null {
  if (!result) return null;
  return JSON.stringify(result, null, 2);
}
