import { useEffect, useRef, useState } from "react";
import { useBackground } from "../hooks/useBackground";
import { StatusBar } from "../components/StatusBar";
import type {
  AiFormat,
  AiMode,
  AiSettings,
  AiSettingsForUi,
} from "@/shared/types";

const AI_UI_TIMEOUT_MS = 35_000;

const DEFAULTS: AiSettings = {
  enabled: false,
  apiFormat: "openai",
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  mode: "uncertain",
  maxItems: 80,
  anthropic1mContext: false,
};

const FORMAT_PRESETS: Record<
  AiFormat,
  { urlPlaceholder: string; modelPlaceholder: string; hint: string }
> = {
  openai: {
    urlPlaceholder: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4.1-mini",
    hint: "适用于 OpenAI / DeepSeek / OpenRouter / OneAPI / Moonshot 等走 /v1/chat/completions 的接口。",
  },
  anthropic: {
    urlPlaceholder: "https://anyrouter.top/v1",
    modelPlaceholder: "claude-sonnet-4-5-20250929",
    hint: "适用于 Anthropic 官方 / anyrouter.top / claude-code-router 等走 /v1/messages 的接口。",
  },
};

export function AISettingsPage() {
  const send = useBackground();
  const [settings, setSettings] = useState<AiSettings>(DEFAULTS);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"info" | "success" | "warning" | "error">("info");
  const [busy, setBusy] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await send({ command: "get-ai-settings" });
        setSettings(extractSettings(s));
        if (s.apiKey) fetchModels(s, true);
      } catch (err) {
        setStatusKind("error");
        setStatus((err as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function scheduleFetchModels() {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => fetchModels(settings, true), 400);
  }

  async function fetchModels(current: AiSettings, quiet = false) {
    if (!current.apiBaseUrl || !current.apiKey) {
      if (!quiet) {
        setStatusKind("warning");
        setStatus("请先填写 API Base URL 和 API Key。");
      }
      return;
    }
    setBusy(true);
    if (!quiet) {
      setStatusKind("info");
      setStatus("正在获取模型列表...");
    }
    try {
      const res = await send(
        { command: "list-ai-models", settings: current },
        AI_UI_TIMEOUT_MS,
      );
      setModels(res.models);
      if (res.models.length && (!current.model || current.model === "gpt-4.1-mini")) {
        setSettings((prev) => ({ ...prev, model: res.models[0] }));
      }
      if (!quiet) {
        setStatusKind(res.count > 0 ? "success" : "warning");
        setStatus(
          res.count > 0
            ? `已加载 ${res.count} 个模型`
            : "接口未返回模型,可手动填写。",
        );
      }
    } catch (err) {
      setStatusKind("error");
      setStatus(
        `获取模型失败:${(err as Error).message}\n如果第三方接口不支持 /models,可直接手动填写模型名。`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await send({ command: "save-ai-settings", settings });
      setSettings(extractSettings(res));
      setStatusKind("success");
      setStatus(`已保存于 ${res.savedAt ?? new Date().toISOString()}`);
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setStatusKind("info");
    setStatus("正在测试接口...");
    try {
      const res = await send(
        { command: "test-ai-settings", settings },
        AI_UI_TIMEOUT_MS,
      );
      setStatusKind("success");
      setStatus(`测试通过 · 模型 ${res.model} · 返回 ${res.items.length} 条`);
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-page">
      <header className="section-header">
        <h2>AI 分类增强</h2>
      </header>
      <p className="muted">
        启用后,规则无法高置信度分类的书签会送给 AI 处理。只发送标题、域名、原路径和去掉 query 的 URL。
        API Key 仅保存在本地 Chrome 存储。
      </p>

      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => patch("enabled", e.target.checked)}
        />
        启用 AI 增强分类
      </label>

      <div className="form-grid">
        <Field label="API 格式">
          <select
            value={settings.apiFormat}
            onChange={(e) => patch("apiFormat", e.target.value as AiFormat)}
          >
            <option value="openai">OpenAI 兼容 (/chat/completions)</option>
            <option value="anthropic">Anthropic 原生 (/messages)</option>
          </select>
          <p className="field-hint">{FORMAT_PRESETS[settings.apiFormat].hint}</p>
        </Field>

        <Field label="API Base URL">
          <input
            type="text"
            value={settings.apiBaseUrl}
            placeholder={FORMAT_PRESETS[settings.apiFormat].urlPlaceholder}
            onChange={(e) => patch("apiBaseUrl", e.target.value)}
            onBlur={scheduleFetchModels}
          />
        </Field>

        <Field label="模型">
          <div className="inline-control">
            <input
              type="text"
              value={settings.model}
              placeholder={FORMAT_PRESETS[settings.apiFormat].modelPlaceholder}
              onChange={(e) => patch("model", e.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => fetchModels(settings, false)}
            >
              获取模型
            </button>
          </div>
          {models.length > 0 && (
            <select
              className="model-picker"
              value=""
              onChange={(e) => {
                if (e.target.value) patch("model", e.target.value);
              }}
            >
              <option value="">— 从 {models.length} 个可用模型中选择 —</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="API Key">
          <input
            type="password"
            value={settings.apiKey}
            autoComplete="off"
            placeholder="sk-..."
            onChange={(e) => patch("apiKey", e.target.value)}
            onBlur={scheduleFetchModels}
          />
        </Field>

        <Field label="AI 处理范围">
          <select
            value={settings.mode}
            onChange={(e) => patch("mode", e.target.value as AiMode)}
          >
            <option value="uncertain">仅低置信度/归档</option>
            <option value="medium">低/中置信度</option>
            <option value="all">全部书签</option>
          </select>
        </Field>

        <Field label="单次最多交给 AI 的书签数">
          <input
            type="number"
            min={1}
            max={300}
            step={1}
            value={settings.maxItems}
            onChange={(e) => patch("maxItems", Number(e.target.value || 80))}
          />
        </Field>
      </div>

      {settings.apiFormat === "anthropic" && (
        <label className="checkbox-line" style={{ marginTop: 16 }}>
          <input
            type="checkbox"
            checked={settings.anthropic1mContext}
            onChange={(e) => patch("anthropic1mContext", e.target.checked)}
          />
          启用 Claude 1M 上下文 (anthropic-beta: context-1m-2025-08-07)
          <span className="field-hint" style={{ marginLeft: 8, marginTop: 0 }}>
            — 用于 claude-opus-4-x / claude-sonnet-4-5 等要求 1M 上下文的模型
          </span>
        </label>
      )}

      <div className="section-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
          保存设置
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={test}>
          测试接口
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 16 }}>
          <StatusBar kind={statusKind}>{status}</StatusBar>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function extractSettings(ui: AiSettingsForUi): AiSettings {
  // strip UI-only props
  const { ...rest } = ui;
  delete (rest as Partial<AiSettingsForUi>).hasApiKey;
  delete (rest as Partial<AiSettingsForUi>).savedAt;
  return rest as AiSettings;
}
