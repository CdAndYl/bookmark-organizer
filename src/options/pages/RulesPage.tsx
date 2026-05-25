import { useEffect, useRef, useState } from "react";
import { useRulePack } from "../hooks/useRulePack";
import { RuleEditor } from "../components/RuleEditor";
import { StatusBar } from "../components/StatusBar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  validateRulePack,
  type RulePack,
} from "@/core/classifier/ruleSchema";

export function RulesPage() {
  const { pack, isDefault, loading, error, save, reset } = useRulePack();
  const [draft, setDraft] = useState<RulePack | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] =
    useState<"info" | "success" | "warning" | "error">("info");
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pack) setDraft(pack);
  }, [pack]);

  if (loading) return <p>正在加载规则...</p>;
  if (error) return <StatusBar kind="error">{error}</StatusBar>;
  if (!pack || !draft) return <StatusBar kind="error">规则数据缺失</StatusBar>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(pack);

  async function doSave() {
    if (!draft) return;
    try {
      validateRulePack(draft);
    } catch (err) {
      setStatusKind("error");
      setStatus(`规则不合法:${(err as Error).message}`);
      return;
    }
    try {
      await save(draft);
      setStatusKind("success");
      setStatus("规则已保存。回到「整理」页可看到新预览。");
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message);
    }
  }

  async function doReset() {
    setResetOpen(false);
    try {
      await reset();
      setStatusKind("success");
      setStatus("已重置为默认规则。");
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message);
    }
  }

  function doExport() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmark-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validated = validateRulePack(json);
      setDraft(validated);
      setStatusKind("info");
      setStatus(`已加载「${validated.name}」,点击「保存规则」生效。`);
    } catch (err) {
      setStatusKind("error");
      setStatus(`导入失败:${(err as Error).message}`);
    }
  }

  return (
    <div className="rules-page">
      <header className="section-header">
        <div>
          <h2>规则编辑器</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            当前规则集:<b>{draft.name}</b>
            {isDefault && !dirty ? "(默认)" : dirty ? "(已修改)" : "(自定义)"}
            · {draft.categories.length} 个分类 · {draft.rules.length} 条规则
          </p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => fileRef.current?.click()}
          >
            导入 JSON
          </button>
          <button type="button" className="btn btn--ghost" onClick={doExport}>
            导出 JSON
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--danger-text"
            onClick={() => setResetOpen(true)}
          >
            重置默认
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setDraft(pack);
              setStatus(null);
            }}
            disabled={!dirty}
          >
            放弃改动
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={doSave}
            disabled={!dirty}
          >
            保存规则
          </button>
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) doImport(file);
          e.target.value = "";
        }}
      />

      {status && (
        <div style={{ marginBottom: 12 }}>
          <StatusBar kind={statusKind}>{status}</StatusBar>
        </div>
      )}

      <RuleEditor pack={draft} onChange={setDraft} dirty={dirty} />

      <ConfirmDialog
        open={resetOpen}
        title="重置为默认规则?"
        message="当前自定义规则会被清空,无法撤销。建议先导出备份。"
        confirmLabel="重置"
        destructive
        onConfirm={doReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
