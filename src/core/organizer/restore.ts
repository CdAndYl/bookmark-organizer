import * as bookmarks from "@/platform/bookmarks";
import { storageSet } from "@/platform/storage";
import {
  collectUrls,
  getRoots,
} from "@/core/classifier/bookmarkTraversal";
import { loadActiveRulePack } from "@/core/classifier/rulesService";
import { getBackup } from "./backup";
import type {
  BackupNode,
  BookmarkUrl,
  RestoreResult,
} from "@/shared/types";

function collectBackupUrls(node: BackupNode, out: BackupNode[]): void {
  if (node.url) {
    out.push(node);
    return;
  }
  for (const child of node.children ?? []) collectBackupUrls(child, out);
}

async function restoreChildren(
  backupParent: BackupNode,
  currentParentId: string,
  currentUrlsById: Map<string, BookmarkUrl>,
): Promise<void> {
  let index = 0;
  for (const child of backupParent.children ?? []) {
    if (child.url) {
      const current = currentUrlsById.get(child.id);
      if (current) {
        await bookmarks.move(current.id, { parentId: currentParentId, index });
      } else {
        await bookmarks.create({
          parentId: currentParentId,
          index,
          title: child.title || child.url,
          url: child.url,
        });
      }
      index += 1;
      continue;
    }
    const createdFolder = await bookmarks.create({
      parentId: currentParentId,
      title: child.title,
      index,
    });
    index += 1;
    await restoreChildren(child, createdFolder.id, currentUrlsById);
  }
}

export async function restoreBackup(backupId: string): Promise<RestoreResult> {
  const backup = await getBackup(backupId);
  if (!backup?.root) throw new Error("Backup not found.");

  const [currentRoot] = await bookmarks.getTree();
  const { bookmarkBar } = getRoots(currentRoot);
  if (!bookmarkBar) throw new Error("Cannot find Chrome bookmark bar.");

  const backupUrls: BackupNode[] = [];
  collectBackupUrls(backup.root, backupUrls);
  const backupUrlIds = new Set(backupUrls.map((b) => b.id));

  const currentUrls: BookmarkUrl[] = [];
  collectUrls(currentRoot, "root", currentUrls);
  const currentUrlsById = new Map(currentUrls.map((u) => [u.id, u]));

  const { pack } = await loadActiveRulePack();
  const organizedTopTitles = new Set(pack.categories.map((c) => c.title));
  const generatedTopFolders = (bookmarkBar.children ?? [])
    .filter((c) => !c.url && organizedTopTitles.has(c.title))
    .map((c) => c.id);

  const extraUrls = currentUrls.filter((u) => !backupUrlIds.has(u.id));
  let extrasFolderId: string | null = null;
  if (extraUrls.length > 0) {
    const extras = await bookmarks.create({
      parentId: bookmarkBar.id,
      title: "整理后新增待确认",
      index: 0,
    });
    extrasFolderId = extras.id;
    for (const item of extraUrls) {
      await bookmarks.move(item.id, { parentId: extrasFolderId });
    }
  }

  for (const backupRootChild of backup.root.children ?? []) {
    const idx = (backup.root.children ?? []).findIndex(
      (c) => c.id === backupRootChild.id,
    );
    const currentRootChild = currentRoot.children?.[idx];
    if (!currentRootChild) continue;
    await restoreChildren(backupRootChild, currentRootChild.id, currentUrlsById);
  }

  const removeFailures: { id: string; error: string }[] = [];
  for (const folderId of generatedTopFolders) {
    if (folderId === extrasFolderId) continue;
    try {
      await bookmarks.removeTree(folderId);
    } catch (error) {
      removeFailures.push({ id: folderId, error: (error as Error).message });
    }
  }

  const result: RestoreResult = {
    status: "restored",
    restoredFrom: backup.at,
    restoredUrls: backupUrls.length,
    preservedNewUrls: extraUrls.length,
    removeFailures,
    at: new Date().toISOString(),
  };
  await storageSet({ lastResult: result });
  return result;
}
