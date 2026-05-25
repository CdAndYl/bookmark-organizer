import type { RulePack } from "@/core/classifier/ruleSchema";

export const DEFAULT_SYSTEM_PROMPT =
  "你是书签分类器。只能从给定 taxonomy 中选择 categoryId 和 subfolderId。返回严格 JSON,不要解释。若不确定,选择 archive 分类下的 fallback subfolder。";

export interface AiItem {
  id: string;
  title: string;
  domain: string;
  safeUrl: string;
  path: string;
  rule: { categoryId: string; subfolderId: string; confidence: string };
}

export function buildTaxonomy(pack: RulePack) {
  return pack.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      categoryId: c.id,
      title: c.title,
      subfolders: c.subfolders.map((s) => ({ id: s.id, title: s.title })),
    }));
}

export function buildUserPrompt(pack: RulePack, items: AiItem[]): string {
  return JSON.stringify({
    task: "classify_browser_bookmarks",
    output_schema: {
      items: [
        {
          id: "string",
          categoryId: "one of taxonomy.categoryId",
          subfolderId: "one of taxonomy.subfolders[].id under chosen category",
          confidence: "high|medium|low",
        },
      ],
    },
    privacy_note: "safeUrl excludes query string and hash.",
    taxonomy: buildTaxonomy(pack),
    items,
  });
}
