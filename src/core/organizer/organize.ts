import * as bookmarks from "@/platform/bookmarks";
import { storageSet } from "@/platform/storage";
import {
  collectUrls,
  getRoots,
} from "@/core/classifier/bookmarkTraversal";
import { classifyAll, type Classification } from "@/core/classifier/ruleEngine";
import {
  loadActiveRulePack,
} from "@/core/classifier/rulesService";
import type { RulePack } from "@/core/classifier/ruleSchema";
import { getStoredAiSettings } from "@/core/ai/settings";
import { classifyWithAi, type AiClassificationItem } from "@/core/ai/client";
import type { AiItem } from "@/core/ai/prompt";
import { createBackup } from "./backup";
import type {
  AiRunSummary,
  AiSettings,
  BookmarkUrl,
  MoveFailure,
  OrganizeResult,
} from "@/shared/types";

function makeCategoryCounts(pack: RulePack): Record<string, number> {
  return Object.fromEntries(pack.categories.map((c) => [c.title, 0]));
}

function shouldSendToAi(
  classification: Classification,
  settings: AiSettings,
  archiveCategoryId: string,
): boolean {
  if (!settings.enabled || !settings.apiKey) return false;
  if (settings.mode === "all") return true;
  if (settings.mode === "medium") return classification.confidence !== "high";
  return (
    classification.confidence === "low" ||
    classification.categoryId === archiveCategoryId
  );
}

function buildAiCandidates(
  urls: BookmarkUrl[],
  classifications: Map<string, Classification>,
  settings: AiSettings,
  pack: RulePack,
): AiItem[] {
  const out: AiItem[] = [];
  for (const item of urls) {
    const result = classifications.get(item.id);
    if (!result) continue;
    if (!shouldSendToAi(result, settings, pack.archiveCategoryId)) continue;
    out.push({
      id: item.id,
      title: item.title,
      domain: item.domain,
      safeUrl: item.safeUrl,
      path: item.path,
      rule: {
        categoryId: result.categoryId,
        subfolderId: result.subfolderId,
        confidence: result.confidence,
      },
    });
    if (out.length >= settings.maxItems) break;
  }
  return out;
}

function validateAiResult(
  raw: AiClassificationItem,
  pack: RulePack,
): Classification | null {
  const category = pack.categories.find((c) => c.id === raw.categoryId);
  if (!category) return null;
  const subfolder = category.subfolders.find((s) => s.id === raw.subfolderId);
  if (!subfolder) return null;
  const confidence = (["high", "medium", "low"] as const).includes(
    raw.confidence as "high" | "medium" | "low",
  )
    ? (raw.confidence as "high" | "medium" | "low")
    : "medium";
  return {
    categoryId: category.id,
    subfolderId: subfolder.id,
    confidence,
    points: 0,
    margin: 0,
    source: "ai",
    matchedRules: [],
  };
}

async function applyAi(
  urls: BookmarkUrl[],
  classifications: Map<string, Classification>,
  pack: RulePack,
): Promise<AiRunSummary> {
  const settings = await getStoredAiSettings();
  const summary: AiRunSummary = {
    enabled: settings.enabled,
    mode: settings.mode,
    requested: 0,
    accepted: 0,
    rejected: 0,
    error: null,
    usage: null,
  };
  const candidates = buildAiCandidates(urls, classifications, settings, pack);
  summary.requested = candidates.length;
  if (candidates.length === 0) return summary;

  try {
    const result = await classifyWithAi(settings, pack, candidates);
    const sentIds = new Set(candidates.map((c) => c.id));
    for (const item of result.items) {
      if (!sentIds.has(String(item.id))) {
        summary.rejected += 1;
        continue;
      }
      const validated = validateAiResult(item, pack);
      if (!validated) {
        summary.rejected += 1;
        continue;
      }
      classifications.set(String(item.id), validated);
      summary.accepted += 1;
    }
    summary.usage = result.usage;
  } catch (error) {
    summary.error = (error as Error).message;
  }
  return summary;
}

export async function organize(): Promise<OrganizeResult> {
  const [root] = await bookmarks.getTree();
  const { bookmarkBar, other, mobile } = getRoots(root);
  if (!bookmarkBar || !other) {
    throw new Error("Cannot find normal Chrome bookmark roots.");
  }

  const urls: BookmarkUrl[] = [];
  collectUrls(bookmarkBar, "bookmark_bar", urls);
  collectUrls(other, "other", urls);
  collectUrls(mobile, "mobile", urls);

  const backup = await createBackup(root, urls.length);

  const originalTopLevel = [
    ...(bookmarkBar.children ?? []),
    ...(other.children ?? []),
    ...(mobile?.children ?? []),
  ];
  const originalFolders = originalTopLevel
    .filter((child) => !child.url)
    .map((child) => child.id);

  const { pack } = await loadActiveRulePack();
  const classifications = classifyAll(urls, pack);
  const aiSummary = await applyAi(urls, classifications, pack);

  const categoryCounts = makeCategoryCounts(pack);
  const sourceCounts = { rule: 0, ai: 0 };
  for (const item of urls) {
    const result = classifications.get(item.id);
    if (!result) continue;
    const cat = pack.categories.find((c) => c.id === result.categoryId);
    if (cat) categoryCounts[cat.title] = (categoryCounts[cat.title] ?? 0) + 1;
    sourceCounts[result.source] += 1;
  }

  // Create top folders + needed subfolders (only those that have items).
  const folderIds: Record<string, Record<string, string>> = {};
  const sortedCategories = pack.categories.slice().sort((a, b) => a.order - b.order);
  let topIndex = 0;
  for (const top of sortedCategories) {
    const subBuckets = new Set(
      urls
        .map((u) => classifications.get(u.id))
        .filter((c): c is Classification => Boolean(c) && c!.categoryId === top.id)
        .map((c) => c.subfolderId),
    );
    if (subBuckets.size === 0 && top.id === pack.archiveCategoryId) continue;
    if (subBuckets.size === 0) continue;
    const createdTop = await bookmarks.create({
      parentId: bookmarkBar.id,
      title: top.title,
      index: topIndex,
    });
    topIndex += 1;
    folderIds[top.id] = {};
    let subIndex = 0;
    for (const sub of top.subfolders) {
      if (!subBuckets.has(sub.id)) continue;
      const createdSub = await bookmarks.create({
        parentId: createdTop.id,
        title: sub.title,
        index: subIndex,
      });
      subIndex += 1;
      folderIds[top.id][sub.id] = createdSub.id;
    }
  }

  const moved: string[] = [];
  const moveFailures: MoveFailure[] = [];
  for (const item of urls) {
    const result = classifications.get(item.id);
    if (!result) {
      moveFailures.push({
        id: item.id,
        title: item.title,
        url: item.url,
        error: "Missing classification result.",
      });
      continue;
    }
    const parentId = folderIds[result.categoryId]?.[result.subfolderId];
    if (!parentId) {
      moveFailures.push({
        id: item.id,
        title: item.title,
        url: item.url,
        error: "Target folder was not created.",
      });
      continue;
    }
    try {
      await bookmarks.move(item.id, { parentId });
      moved.push(item.id);
    } catch (error) {
      moveFailures.push({
        id: item.id,
        title: item.title,
        url: item.url,
        error: (error as Error).message,
      });
    }
  }

  const removeFailures: { id: string; error: string }[] = [];
  if (moveFailures.length === 0) {
    for (const id of originalFolders) {
      try {
        await bookmarks.removeTree(id);
      } catch (error) {
        removeFailures.push({ id, error: (error as Error).message });
      }
    }
  }

  const result: OrganizeResult = {
    status: moveFailures.length === 0 ? "organized" : "partial",
    totalBefore: urls.length,
    moved: moved.length,
    categoryCounts,
    sourceCounts,
    ai: aiSummary,
    moveFailures,
    removeFailures,
    backupId: backup.id,
    backupAt: backup.at,
    at: new Date().toISOString(),
  };
  await storageSet({ lastResult: result });
  return result;
}
