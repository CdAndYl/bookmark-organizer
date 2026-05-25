import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classify } from "@/core/classifier/ruleEngine";
import { validateRulePack, type RulePack } from "@/core/classifier/ruleSchema";
import type { BookmarkUrl } from "@/shared/types";
import { domainOf, safeUrlOf } from "@/core/classifier/bookmarkTraversal";

let pack: RulePack;

function makeItem(partial: Partial<BookmarkUrl> & { url: string; title?: string; path?: string }): BookmarkUrl {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    parentId: undefined,
    topFolderId: null,
    title: partial.title ?? "",
    url: partial.url,
    safeUrl: safeUrlOf(partial.url),
    path: partial.path ?? "bookmark_bar",
    domain: domainOf(partial.url),
  };
}

beforeAll(() => {
  const file = resolve(__dirname, "../public/default-rules.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  pack = validateRulePack(json);
});

describe("default rule pack", () => {
  it("loads and validates", () => {
    expect(pack.categories.length).toBeGreaterThan(0);
    expect(pack.rules.length).toBeGreaterThan(0);
    expect(pack.archiveCategoryId).toBe("archive");
  });
});

describe("classify", () => {
  it("classifies ChatGPT into AI tools", () => {
    const result = classify(
      makeItem({ title: "ChatGPT", url: "https://chatgpt.com/" }),
      pack,
    );
    expect(result.categoryId).toBe("ai");
    expect(result.subfolderId).toBe("ai-tools");
  });

  it("classifies GitHub into Git", () => {
    const result = classify(
      makeItem({ title: "GitHub", url: "https://github.com/" }),
      pack,
    );
    expect(result.categoryId).toBe("dev");
    expect(result.subfolderId).toBe("dev-git");
  });

  it("classifies localhost into internal accounts", () => {
    const result = classify(
      makeItem({ title: "本地后台", url: "http://localhost:8080/" }),
      pack,
    );
    expect(result.categoryId).toBe("accounts");
    expect(result.subfolderId).toBe("accounts-local");
  });

  it("classifies LeetCode into interview", () => {
    const result = classify(
      makeItem({ title: "LeetCode 算法题", url: "https://leetcode.cn/" }),
      pack,
    );
    expect(result.categoryId).toBe("learning");
    expect(result.subfolderId).toBe("learning-interview");
  });

  it("classifies bilibili into video", () => {
    const result = classify(
      makeItem({ title: "B站", url: "https://www.bilibili.com/" }),
      pack,
    );
    expect(result.categoryId).toBe("community");
    expect(result.subfolderId).toBe("community-video");
  });

  it("classifies untitled tabs into archive", () => {
    const result = classify(
      makeItem({ title: "无标题", url: "https://example.com/foo" }),
      pack,
    );
    expect(result.categoryId).toBe("archive");
    expect(result.subfolderId).toBe("archive-untitled");
  });

  it("falls back to archive for unknown bookmarks", () => {
    const result = classify(
      makeItem({ title: "Random site", url: "https://random-unknown-xyz.example/" }),
      pack,
    );
    expect(result.categoryId).toBe("archive");
    expect(result.confidence).toBe("low");
  });

  it("classifies a CSDN blog as dev blog", () => {
    const result = classify(
      makeItem({
        title: "C# 入门教程",
        url: "https://blog.csdn.net/foo/article/details/1",
      }),
      pack,
    );
    expect(result.categoryId).toBe("dev");
  });

  it("classifies Python tutorial into Python", () => {
    const result = classify(
      makeItem({
        title: "Python pandas 入门",
        url: "https://docs.python.org/3/",
      }),
      pack,
    );
    expect(result.categoryId).toBe("dev");
    expect(result.subfolderId).toBe("dev-python");
  });

  it("classifies Tencent Cloud console as cloud accounts", () => {
    const result = classify(
      makeItem({
        title: "腾讯云控制台",
        url: "https://console.cloud.tencent.com/",
      }),
      pack,
    );
    expect(result.categoryId).toBe("accounts");
    expect(result.subfolderId).toBe("accounts-cloud");
  });
});
