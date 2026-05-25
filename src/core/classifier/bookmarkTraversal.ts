import type { BookmarkUrl } from "@/shared/types";

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function safeUrlOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

export function collectUrls(
  node: chrome.bookmarks.BookmarkTreeNode | undefined,
  path: string,
  output: BookmarkUrl[],
  topFolderId: string | null = null,
): void {
  if (!node) return;
  if (node.url) {
    output.push({
      id: node.id,
      parentId: node.parentId,
      topFolderId,
      title: node.title || "",
      url: node.url,
      safeUrl: safeUrlOf(node.url),
      path,
      domain: domainOf(node.url),
    });
    return;
  }
  const nextPath = node.title ? `${path}/${node.title}` : path;
  const nextTopFolderId = topFolderId || node.id;
  for (const child of node.children || []) {
    collectUrls(child, nextPath, output, nextTopFolderId);
  }
}

export function countUrls(
  node: chrome.bookmarks.BookmarkTreeNode | undefined,
): number {
  if (!node) return 0;
  if (node.url) return 1;
  return (node.children || []).reduce((sum, c) => sum + countUrls(c), 0);
}

export function getRoots(root: chrome.bookmarks.BookmarkTreeNode): {
  bookmarkBar: chrome.bookmarks.BookmarkTreeNode | undefined;
  other: chrome.bookmarks.BookmarkTreeNode | undefined;
  mobile: chrome.bookmarks.BookmarkTreeNode | undefined;
} {
  const children = root.children || [];
  return {
    bookmarkBar: children[0],
    other: children[1],
    mobile: children[2],
  };
}
