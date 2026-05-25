import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyWithAi } from "@/core/ai/client";
import { validateRulePack, type RulePack } from "@/core/classifier/ruleSchema";
import type { AiItem } from "@/core/ai/prompt";
import type { AiSettings } from "@/shared/types";

let pack: RulePack;

const sampleItem: AiItem = {
  id: "test-1",
  title: "OpenAI API 文档",
  domain: "platform.openai.com",
  path: "test",
  safeUrl: "https://platform.openai.com/docs",
  rule: { categoryId: "ai", subfolderId: "ai-models-docs", confidence: "medium" },
};

const baseSettings = {
  enabled: true,
  apiKey: "sk-test-key",
  model: "test-model",
  mode: "uncertain",
  maxItems: 80,
  anthropic1mContext: false,
} as const;

function loadPack(): RulePack {
  const file = resolve(__dirname, "../public/default-rules.json");
  return validateRulePack(JSON.parse(readFileSync(file, "utf8")));
}

beforeEach(() => {
  pack = loadPack();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: { status: number; body: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("classifyWithAi — OpenAI format", () => {
  const settings: AiSettings = {
    ...baseSettings,
    apiFormat: "openai",
    apiBaseUrl: "https://api.openai.com/v1",
  };

  it("hits /chat/completions and parses choices[].message.content", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    id: "test-1",
                    categoryId: "ai",
                    subfolderId: "ai-tools",
                    confidence: "high",
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      },
    });

    const result = await classifyWithAi(settings, pack, [sampleItem]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://api.openai.com/v1/chat/completions");

    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.model).toBe("test-model");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body).not.toHaveProperty("system");
    expect(body).not.toHaveProperty("max_tokens");

    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-key");
    expect(headers["x-api-key"]).toBeUndefined();

    expect(result.items[0].subfolderId).toBe("ai-tools");
    expect(result.usage?.total_tokens).toBe(120);
  });

  it("strips trailing /chat/completions from base url", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: { choices: [{ message: { content: '{"items":[]}' } }] },
    });
    await classifyWithAi(
      { ...settings, apiBaseUrl: "https://api.openai.com/v1/chat/completions" },
      pack,
      [sampleItem],
    );
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("throws on non-2xx", async () => {
    mockFetch({ status: 401, body: { error: "Unauthorized" } });
    await expect(classifyWithAi(settings, pack, [sampleItem])).rejects.toThrow(
      /AI API 401/,
    );
  });
});

describe("classifyWithAi — Anthropic format", () => {
  const settings: AiSettings = {
    ...baseSettings,
    apiFormat: "anthropic",
    apiBaseUrl: "https://anyrouter.top/v1",
    model: "claude-sonnet-4-5-20250929",
  };

  it("hits /messages with anthropic headers and top-level system", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              items: [
                {
                  id: "test-1",
                  categoryId: "ai",
                  subfolderId: "ai-models-docs",
                  confidence: "medium",
                },
              ],
            }),
          },
        ],
        usage: { input_tokens: 200, output_tokens: 40 },
      },
    });

    const result = await classifyWithAi(settings, pack, [sampleItem]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe("https://anyrouter.top/v1/messages");

    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.model).toBe("claude-sonnet-4-5-20250929");
    expect(body.system).toBeTruthy();
    expect(typeof body.system).toBe("string");
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages.some((m: { role: string }) => m.role === "system")).toBe(
      false,
    );

    const headers = init?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.Authorization).toBe("Bearer sk-test-key");

    expect(result.items[0].subfolderId).toBe("ai-models-docs");
    expect(result.usage?.prompt_tokens).toBe(200);
    expect(result.usage?.completion_tokens).toBe(40);
    expect(result.usage?.total_tokens).toBe(240);
  });

  it("strips trailing /messages from base url", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: { content: [{ type: "text", text: '{"items":[]}' }] },
    });
    await classifyWithAi(
      { ...settings, apiBaseUrl: "https://anyrouter.top/v1/messages" },
      pack,
      [sampleItem],
    );
    expect(fetchSpy.mock.calls[0][0]).toBe("https://anyrouter.top/v1/messages");
  });

  it("throws on non-2xx", async () => {
    mockFetch({ status: 404, body: { error: "model not supported" } });
    await expect(classifyWithAi(settings, pack, [sampleItem])).rejects.toThrow(
      /AI API 404/,
    );
  });

  it("throws when response has no text content blocks", async () => {
    mockFetch({ status: 200, body: { content: [] } });
    await expect(classifyWithAi(settings, pack, [sampleItem])).rejects.toThrow(
      /no text content/i,
    );
  });

  it("does not send anthropic-beta header when 1m context off", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: { content: [{ type: "text", text: '{"items":[]}' }] },
    });
    await classifyWithAi(settings, pack, [sampleItem]);
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["anthropic-beta"]).toBeUndefined();
  });

  it("sends anthropic-beta header when 1m context on", async () => {
    const fetchSpy = mockFetch({
      status: 200,
      body: { content: [{ type: "text", text: '{"items":[]}' }] },
    });
    await classifyWithAi(
      { ...settings, anthropic1mContext: true },
      pack,
      [sampleItem],
    );
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["anthropic-beta"]).toBe("context-1m-2025-08-07");
  });
});

describe("classifyWithAi — empty input", () => {
  it("returns empty without calling fetch", async () => {
    const fetchSpy = mockFetch({ status: 200, body: {} });
    const result = await classifyWithAi(
      {
        ...baseSettings,
        apiFormat: "openai",
        apiBaseUrl: "https://api.openai.com/v1",
      },
      pack,
      [],
    );
    expect(result.items).toEqual([]);
    expect(result.usage).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
