import { storageGet, storageSet } from "@/platform/storage";
import type { AiSettings, AiSettingsForUi, AiMode } from "@/shared/types";

const STORAGE_KEY = "aiSettings";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  mode: "uncertain",
  maxItems: 80,
};

type StorageShape = { aiSettings?: Partial<AiSettings> } & Record<
  string,
  unknown
>;

export function normalizeAiSettings(input: Partial<AiSettings> = {}): AiSettings {
  const mode: AiMode = (["uncertain", "medium", "all"] as const).includes(
    input.mode as AiMode,
  )
    ? (input.mode as AiMode)
    : DEFAULT_AI_SETTINGS.mode;
  const maxItems = Math.max(
    1,
    Math.min(300, Number(input.maxItems) || DEFAULT_AI_SETTINGS.maxItems),
  );
  return {
    enabled: Boolean(input.enabled),
    apiBaseUrl: String(input.apiBaseUrl || DEFAULT_AI_SETTINGS.apiBaseUrl)
      .trim()
      .replace(/\/+$/, ""),
    apiKey: String(input.apiKey || "").trim(),
    model: String(input.model || DEFAULT_AI_SETTINGS.model).trim(),
    mode,
    maxItems,
  };
}

export async function getStoredAiSettings(): Promise<AiSettings> {
  const storage = await storageGet<StorageShape>(["aiSettings"]);
  return normalizeAiSettings({ ...DEFAULT_AI_SETTINGS, ...(storage.aiSettings ?? {}) });
}

export async function getAiSettingsForUi(): Promise<AiSettingsForUi> {
  const s = await getStoredAiSettings();
  return { ...s, hasApiKey: Boolean(s.apiKey) };
}

export async function saveAiSettings(
  input: Partial<AiSettings>,
): Promise<AiSettingsForUi> {
  const next = normalizeAiSettings(input);
  await storageSet({ [STORAGE_KEY]: next });
  return { ...next, hasApiKey: Boolean(next.apiKey), savedAt: new Date().toISOString() };
}
