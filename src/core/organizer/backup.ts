import { storageGet, storageSet } from "@/platform/storage";
import type { Backup, BackupNode, BackupSummary } from "@/shared/types";

const STORAGE_KEY = "backups";
const MAX_BACKUPS = 5;

type StorageShape = { backups?: Backup[] } & Record<string, unknown>;

export function cloneTree(
  node: chrome.bookmarks.BookmarkTreeNode,
): BackupNode {
  const copy: BackupNode = {
    id: node.id,
    parentId: node.parentId,
    title: node.title || "",
  };
  if (node.url) copy.url = node.url;
  if (node.children) copy.children = node.children.map(cloneTree);
  return copy;
}

export async function createBackup(
  root: chrome.bookmarks.BookmarkTreeNode,
  total: number,
): Promise<Backup> {
  const id = `bk-${Date.now().toString(36)}`;
  const backup: Backup = {
    id,
    at: new Date().toISOString(),
    total,
    root: cloneTree(root),
  };
  const storage = await storageGet<StorageShape>(["backups"]);
  const existing = storage.backups ?? [];
  const next = [backup, ...existing].slice(0, MAX_BACKUPS);
  await storageSet({ [STORAGE_KEY]: next });
  return backup;
}

export async function listBackups(): Promise<BackupSummary[]> {
  const storage = await storageGet<StorageShape>(["backups"]);
  return (storage.backups ?? []).map(({ id, at, total }) => ({ id, at, total }));
}

export async function getBackup(id: string): Promise<Backup | undefined> {
  const storage = await storageGet<StorageShape>(["backups"]);
  return (storage.backups ?? []).find((b) => b.id === id);
}

export async function deleteBackup(id: string): Promise<void> {
  const storage = await storageGet<StorageShape>(["backups"]);
  const next = (storage.backups ?? []).filter((b) => b.id !== id);
  await storageSet({ [STORAGE_KEY]: next });
}
