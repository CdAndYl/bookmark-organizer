import * as bookmarks from "@/platform/bookmarks";
import { storageSet } from "@/platform/storage";
import { collectUrls, getRoots } from "@/core/classifier/bookmarkTraversal";
import { getStoredAiSettings } from "@/core/ai/settings";
import { createBackup } from "./backup";
import { groupByDomain } from "./domainGroup";
import type {
  AiRunSummary,
  BookmarkUrl,
  MoveFailure,
  OrganizeResult,
} from "@/shared/types";

/** Folder name for bookmarks that cannot be grouped by domain. */
export const OTHER_FOLDER_TITLE = "其他";

/**
 * Organize bookmarks into a flat one-level structure grouped by registrable
 * domain (eTLD+1). Reuses the same backup / traversal / platform primitives as
 * the rule/AI `organize()` flow so backup and restore stay strategy-agnostic.
 */
export async function organizeByDomain(): Promise<OrganizeResult> {
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

  const { folders, otherItems } = groupByDomain(urls);

  // Build the ordered list of (title, items) buckets: domain folders first,
  // then "其他" last (only when it has items).
  const buckets: { title: string; items: BookmarkUrl[] }[] = folders.map((f) => ({
    title: f.domain,
    items: f.items,
  }));
  if (otherItems.length > 0) {
    buckets.push({ title: OTHER_FOLDER_TITLE, items: otherItems });
  }

  const categoryCounts: Record<string, number> = {};
  const folderIds: Record<string, string> = {};
  let index = 0;
  for (const bucket of buckets) {
    const created = await bookmarks.create({
      parentId: bookmarkBar.id,
      title: bucket.title,
      index,
    });
    index += 1;
    folderIds[bucket.title] = created.id;
    categoryCounts[bucket.title] = bucket.items.length;
  }

  const moved: string[] = [];
  const moveFailures: MoveFailure[] = [];
  for (const bucket of buckets) {
    const parentId = folderIds[bucket.title];
    for (const item of bucket.items) {
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

  const aiSettings = await getStoredAiSettings();
  const ai: AiRunSummary = {
    enabled: false,
    mode: aiSettings.mode,
    requested: 0,
    accepted: 0,
    rejected: 0,
    error: null,
    usage: null,
  };

  const result: OrganizeResult = {
    status: moveFailures.length === 0 ? "organized" : "partial",
    totalBefore: urls.length,
    moved: moved.length,
    categoryCounts,
    sourceCounts: { rule: moved.length, ai: 0 },
    ai,
    moveFailures,
    removeFailures,
    backupId: backup.id,
    backupAt: backup.at,
    at: new Date().toISOString(),
  };
  await storageSet({ lastResult: result });
  return result;
}
