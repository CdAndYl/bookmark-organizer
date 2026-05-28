import * as bookmarks from "@/platform/bookmarks";
import { storageGet } from "@/platform/storage";
import {
  collectUrls,
  getRoots,
} from "@/core/classifier/bookmarkTraversal";
import { classifyAll } from "@/core/classifier/ruleEngine";
import { loadActiveRulePack } from "@/core/classifier/rulesService";
import { getStoredAiSettings } from "@/core/ai/settings";
import { listBackups } from "./backup";
import { groupByDomain } from "./domainGroup";
import { OTHER_FOLDER_TITLE } from "./organizeByDomain";
import type {
  BookmarkUrl,
  MovePlanEntry,
  OrganizeResult,
  PreviewSnapshot,
  RestoreResult,
} from "@/shared/types";
import type { RulePack } from "@/core/classifier/ruleSchema";

type StorageShape = {
  lastResult?: OrganizeResult | RestoreResult;
} & Record<string, unknown>;

function isOrganized(
  pack: RulePack,
  bookmarkBar: chrome.bookmarks.BookmarkTreeNode,
  other: chrome.bookmarks.BookmarkTreeNode | undefined,
  mobile: chrome.bookmarks.BookmarkTreeNode | undefined,
): boolean {
  const expected = pack.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => c.title);
  const actual = (bookmarkBar.children ?? []).map((c) => c.title);
  const matches =
    actual.length === expected.length &&
    expected.every((title, i) => actual[i] === title);
  const otherEmpty = (other?.children ?? []).length === 0;
  const mobileEmpty = (mobile?.children ?? []).length === 0;
  return matches && otherEmpty && mobileEmpty;
}

export async function getDomainPreview(): Promise<PreviewSnapshot> {
  const [root] = await bookmarks.getTree();
  const { bookmarkBar, other, mobile } = getRoots(root);
  if (!bookmarkBar || !other) {
    throw new Error("Cannot find normal Chrome bookmark roots.");
  }

  const urls: BookmarkUrl[] = [];
  collectUrls(bookmarkBar, "bookmark_bar", urls);
  collectUrls(other, "other", urls);
  collectUrls(mobile, "mobile", urls);

  const { folders, otherItems } = groupByDomain(urls);

  const categoryCounts: Record<string, number> = {};
  const movePlan: MovePlanEntry[] = [];

  function pushBucket(title: string, items: BookmarkUrl[]) {
    if (items.length === 0) return;
    categoryCounts[title] = items.length;
    for (const item of items) {
      movePlan.push({
        bookmarkId: item.id,
        title: item.title || "(无标题)",
        url: item.url,
        fromPath: item.path,
        toCategoryTitle: title,
        toSubfolderTitle: "",
        source: "rule",
        confidence: "high",
      });
    }
  }

  for (const folder of folders) pushBucket(folder.domain, folder.items);
  pushBucket(OTHER_FOLDER_TITLE, otherItems);

  const storage = await storageGet<StorageShape>(["lastResult"]);
  const aiSettings = await getStoredAiSettings();
  const backups = await listBackups();

  return {
    status: "ready",
    total: urls.length,
    categoryCounts,
    sourceCounts: { rule: urls.length, ai: 0 },
    currentTopNames: (bookmarkBar.children ?? []).slice(0, 12).map((c) => c.title),
    otherChildren: (other.children ?? []).length,
    mobileChildren: (mobile?.children ?? []).length,
    movePlan,
    backups,
    lastResult: storage.lastResult ?? null,
    ai: {
      enabled: aiSettings.enabled,
      mode: aiSettings.mode,
      hasApiKey: Boolean(aiSettings.apiKey),
      model: aiSettings.model,
      maxItems: aiSettings.maxItems,
    },
    at: new Date().toISOString(),
  };
}

export async function getPreview(): Promise<PreviewSnapshot> {
  const [root] = await bookmarks.getTree();
  const { bookmarkBar, other, mobile } = getRoots(root);
  if (!bookmarkBar || !other) {
    throw new Error("Cannot find normal Chrome bookmark roots.");
  }

  const urls: BookmarkUrl[] = [];
  collectUrls(bookmarkBar, "bookmark_bar", urls);
  collectUrls(other, "other", urls);
  collectUrls(mobile, "mobile", urls);

  const { pack } = await loadActiveRulePack();
  const classifications = classifyAll(urls, pack);

  const categoryCounts: Record<string, number> = Object.fromEntries(
    pack.categories.map((c) => [c.title, 0]),
  );
  const sourceCounts = { rule: 0, ai: 0 };
  const movePlan: MovePlanEntry[] = [];

  for (const item of urls) {
    const result = classifications.get(item.id);
    if (!result) continue;
    const category = pack.categories.find((c) => c.id === result.categoryId);
    const subfolder = category?.subfolders.find((s) => s.id === result.subfolderId);
    if (!category || !subfolder) continue;
    categoryCounts[category.title] = (categoryCounts[category.title] ?? 0) + 1;
    sourceCounts[result.source] += 1;
    movePlan.push({
      bookmarkId: item.id,
      title: item.title || "(无标题)",
      url: item.url,
      fromPath: item.path,
      toCategoryTitle: category.title,
      toSubfolderTitle: subfolder.title,
      source: result.source,
      confidence: result.confidence,
    });
  }

  const storage = await storageGet<StorageShape>(["lastResult"]);
  const aiSettings = await getStoredAiSettings();
  const backups = await listBackups();

  return {
    status: isOrganized(pack, bookmarkBar, other, mobile) ? "already-organized" : "ready",
    total: urls.length,
    categoryCounts,
    sourceCounts,
    currentTopNames: (bookmarkBar.children ?? []).slice(0, 12).map((c) => c.title),
    otherChildren: (other.children ?? []).length,
    mobileChildren: (mobile?.children ?? []).length,
    movePlan,
    backups,
    lastResult: storage.lastResult ?? null,
    ai: {
      enabled: aiSettings.enabled,
      mode: aiSettings.mode,
      hasApiKey: Boolean(aiSettings.apiKey),
      model: aiSettings.model,
      maxItems: aiSettings.maxItems,
    },
    at: new Date().toISOString(),
  };
}
