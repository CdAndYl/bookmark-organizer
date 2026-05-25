import type { AiSettings, AiUsage } from "@/shared/types";
import type { RulePack } from "@/core/classifier/ruleSchema";
import {
  buildUserPrompt,
  DEFAULT_SYSTEM_PROMPT,
  type AiItem,
} from "./prompt";

const REQUEST_TIMEOUT_MS = 30_000;

function baseRoot(url: string): string {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/models$/i, "");
}

function chatCompletionsUrl(url: string): string {
  return `${baseRoot(url)}/chat/completions`;
}

function modelsUrl(url: string): string {
  return `${baseRoot(url)}/models`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(
        `请求超时(${Math.round(timeoutMs / 1000)} 秒):${url}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function listModels(settings: AiSettings): Promise<{
  models: string[];
  count: number;
  fetchedAt: string;
}> {
  if (!settings.apiKey) throw new Error("请先填写 API Key。");
  const response = await fetchWithTimeout(modelsUrl(settings.apiBaseUrl), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Models API ${response.status}: ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text);
  const rawList = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];
  const candidates: string[] = rawList
    .map((item: unknown): string | null => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const v = obj.id ?? obj.name ?? obj.model;
        return typeof v === "string" ? v : null;
      }
      return null;
    })
    .filter((v: string | null): v is string => v !== null);
  const models = [...new Set(candidates)].sort((a, b) => a.localeCompare(b));
  return { models, count: models.length, fetchedAt: new Date().toISOString() };
}

interface ChatChoice {
  message?: { content?: string };
}
interface ChatPayload {
  choices?: ChatChoice[];
  usage?: AiUsage;
}

function extractJson(text: string): { items: unknown[] } {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI response was empty.");
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI response did not contain JSON.");
    return JSON.parse(match[0]);
  }
}

export interface AiClassificationItem {
  id: string;
  categoryId: string;
  subfolderId: string;
  confidence: string;
}

export async function classifyWithAi(
  settings: AiSettings,
  pack: RulePack,
  items: AiItem[],
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<{ items: AiClassificationItem[]; usage: AiUsage | null }> {
  if (items.length === 0) return { items: [], usage: null };
  const body = {
    model: settings.model,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(pack, items) },
    ],
  };
  const response = await fetchWithTimeout(
    chatCompletionsUrl(settings.apiBaseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI API ${response.status}: ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text) as ChatPayload;
  const content = payload.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);
  if (!Array.isArray(parsed.items)) {
    throw new Error("AI response JSON missing items array.");
  }
  return {
    items: parsed.items as AiClassificationItem[],
    usage: payload.usage ?? null,
  };
}

export async function testAiConnection(
  settings: AiSettings,
  pack: RulePack,
): Promise<{
  status: "ok";
  model: string;
  items: AiClassificationItem[];
  usage: AiUsage | null;
  testedAt: string;
}> {
  if (!settings.apiKey) throw new Error("请先填写 API Key。");
  const aiTools = pack.categories.find((c) => c.id === "ai")?.subfolders.find((s) => s.id.includes("docs"));
  const sample: AiItem[] = [
    {
      id: "test",
      title: "OpenAI API 文档",
      domain: "platform.openai.com",
      path: "test",
      safeUrl: "https://platform.openai.com/docs",
      rule: {
        categoryId: "ai",
        subfolderId: aiTools?.id ?? pack.categories[0].subfolders[0].id,
        confidence: "medium",
      },
    },
  ];
  const result = await classifyWithAi(settings, pack, sample);
  return {
    status: "ok",
    model: settings.model,
    items: result.items,
    usage: result.usage,
    testedAt: new Date().toISOString(),
  };
}
