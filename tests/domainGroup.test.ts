import { describe, it, expect } from "vitest";
import {
  DEFAULT_MIN_DOMAIN_COUNT,
  groupByDomain,
  registrableDomain,
} from "@/core/organizer/domainGroup";
import type { BookmarkUrl } from "@/shared/types";
import { domainOf, safeUrlOf } from "@/core/classifier/bookmarkTraversal";

function makeItem(
  partial: Partial<BookmarkUrl> & { url: string; title?: string; path?: string },
): BookmarkUrl {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    parentId: undefined,
    topFolderId: null,
    title: partial.title ?? "",
    url: partial.url,
    safeUrl: safeUrlOf(partial.url),
    path: partial.path ?? "bookmark_bar",
    domain: partial.domain ?? domainOf(partial.url),
  };
}

describe("registrableDomain", () => {
  it("folds subdomains to the same registrable domain", () => {
    expect(registrableDomain("www.github.com")).toBe("github.com");
    expect(registrableDomain("gist.github.com")).toBe("github.com");
    expect(registrableDomain("github.com")).toBe("github.com");
    expect(registrableDomain("a.b.c.github.com")).toBe("github.com");
  });

  it("keeps three labels for multi-part public suffixes", () => {
    expect(registrableDomain("a.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("b.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("foo.bar.com.cn")).toBe("bar.com.cn");
    expect(registrableDomain("www.shop.com.au")).toBe("shop.com.au");
  });

  it("does not collapse multi-part suffix domains down to the suffix", () => {
    expect(registrableDomain("a.co.uk")).not.toBe("co.uk");
    expect(registrableDomain("a.co.uk")).toBe("a.co.uk");
  });

  it("returns short hostnames and single labels as-is", () => {
    expect(registrableDomain("localhost")).toBe("localhost");
    expect(registrableDomain("example.com")).toBe("example.com");
    // Bare IPs are not special-cased; the heuristic just takes the last two
    // labels, which is acceptable for grouping purposes.
    expect(registrableDomain("127.0.0.1")).toBe("0.1");
  });

  it("normalizes case and trailing dots, returns empty for blank input", () => {
    expect(registrableDomain("WWW.GitHub.COM")).toBe("github.com");
    expect(registrableDomain("github.com.")).toBe("github.com");
    expect(registrableDomain("")).toBe("");
    expect(registrableDomain("   ")).toBe("");
  });
});

describe("groupByDomain", () => {
  it("groups subdomains of the same site into one folder", () => {
    const urls = [
      makeItem({ url: "https://www.github.com/a" }),
      makeItem({ url: "https://gist.github.com/b" }),
      makeItem({ url: "https://github.com/c" }),
    ];
    const { folders, otherItems } = groupByDomain(urls);
    expect(folders).toHaveLength(1);
    expect(folders[0].domain).toBe("github.com");
    expect(folders[0].items).toHaveLength(3);
    expect(otherItems).toHaveLength(0);
  });

  it("keeps a.co.uk and b.co.uk as their own registrable domains, not co.uk", () => {
    const urls = [
      makeItem({ url: "https://x.a.co.uk/1" }),
      makeItem({ url: "https://y.a.co.uk/2" }),
      makeItem({ url: "https://x.b.co.uk/3" }),
      makeItem({ url: "https://y.b.co.uk/4" }),
    ];
    const { folders } = groupByDomain(urls);
    const domains = folders.map((f) => f.domain).sort();
    expect(domains).toEqual(["a.co.uk", "b.co.uk"]);
    expect(domains).not.toContain("co.uk");
  });

  it("sends bookmarks with no resolvable domain to other", () => {
    const urls = [
      makeItem({ url: "https://www.github.com/a", domain: "www.github.com" }),
      makeItem({ url: "https://github.com/b", domain: "github.com" }),
      makeItem({ url: "chrome://extensions", domain: "" }),
      makeItem({ url: "javascript:void(0)", domain: "" }),
    ];
    const { folders, otherItems } = groupByDomain(urls);
    expect(folders).toHaveLength(1);
    expect(folders[0].domain).toBe("github.com");
    expect(otherItems).toHaveLength(2);
  });

  it("folds domains below the min-count threshold into other", () => {
    const urls = [
      makeItem({ url: "https://github.com/a" }),
      makeItem({ url: "https://github.com/b" }),
      makeItem({ url: "https://lonely.example/x" }),
    ];
    const { folders, otherItems } = groupByDomain(urls);
    expect(folders).toHaveLength(1);
    expect(folders[0].domain).toBe("github.com");
    expect(otherItems).toHaveLength(1);
    expect(otherItems[0].url).toBe("https://lonely.example/x");
  });

  it("respects a custom minCount", () => {
    const urls = [
      makeItem({ url: "https://github.com/a" }),
      makeItem({ url: "https://github.com/b" }),
      makeItem({ url: "https://gitlab.com/c" }),
      makeItem({ url: "https://gitlab.com/d" }),
      makeItem({ url: "https://gitlab.com/e" }),
    ];
    const { folders, otherItems } = groupByDomain(urls, { minCount: 3 });
    expect(folders).toHaveLength(1);
    expect(folders[0].domain).toBe("gitlab.com");
    expect(otherItems).toHaveLength(2);
  });

  it("uses DEFAULT_MIN_DOMAIN_COUNT when minCount is omitted", () => {
    const single = [makeItem({ url: "https://solo.example/a" })];
    const { folders, otherItems } = groupByDomain(single);
    expect(DEFAULT_MIN_DOMAIN_COUNT).toBe(2);
    expect(folders).toHaveLength(0);
    expect(otherItems).toHaveLength(1);
  });

  it("sorts folders by count desc, then domain asc", () => {
    const urls = [
      // github.com: 2
      makeItem({ url: "https://github.com/a" }),
      makeItem({ url: "https://github.com/b" }),
      // gitlab.com: 2 (ties with github -> github first alphabetically)
      makeItem({ url: "https://gitlab.com/c" }),
      makeItem({ url: "https://gitlab.com/d" }),
      // youtube.com: 3 (largest -> first)
      makeItem({ url: "https://youtube.com/e" }),
      makeItem({ url: "https://youtube.com/f" }),
      makeItem({ url: "https://youtube.com/g" }),
    ];
    const { folders } = groupByDomain(urls);
    expect(folders.map((f) => f.domain)).toEqual([
      "youtube.com",
      "github.com",
      "gitlab.com",
    ]);
  });
});
