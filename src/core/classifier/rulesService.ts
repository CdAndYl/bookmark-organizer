import { storageGet, storageSet, storageRemove } from "@/platform/storage";
import { validateRulePack, type RulePack } from "./ruleSchema";

const STORAGE_KEY = "userRulePack";

type StorageShape = {
  userRulePack?: RulePack;
} & Record<string, unknown>;

let cachedDefault: RulePack | null = null;

export async function loadDefaultRulePack(): Promise<RulePack> {
  if (cachedDefault) return cachedDefault;
  const url = chrome.runtime.getURL("default-rules.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load default rules: ${res.status}`);
  const json = await res.json();
  cachedDefault = validateRulePack(json);
  return cachedDefault;
}

export async function loadActiveRulePack(): Promise<{
  pack: RulePack;
  isDefault: boolean;
}> {
  const storage = await storageGet<StorageShape>(["userRulePack"]);
  if (storage.userRulePack) {
    try {
      const pack = validateRulePack(storage.userRulePack);
      return { pack, isDefault: false };
    } catch (error) {
      console.warn("[rules] stored pack invalid, falling back to default", error);
    }
  }
  const pack = await loadDefaultRulePack();
  return { pack, isDefault: true };
}

export async function saveUserRulePack(pack: RulePack): Promise<RulePack> {
  const validated = validateRulePack(pack);
  await storageSet({ [STORAGE_KEY]: validated });
  return validated;
}

export async function resetToDefaults(): Promise<RulePack> {
  await storageRemove(STORAGE_KEY);
  return loadDefaultRulePack();
}
