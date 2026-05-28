import type { BookmarkUrl } from "@/shared/types";

/** Domains with fewer bookmarks than this are folded into the "其他" bucket. */
export const DEFAULT_MIN_DOMAIN_COUNT = 2;

/**
 * Common multi-part public suffixes (eTLD with more than one label).
 * Used by the heuristic in `registrableDomain` to keep the registrable domain
 * at three labels (e.g. `example.co.uk`) instead of collapsing to the suffix.
 *
 * This is a deliberately small built-in table (no PSL dependency); it covers
 * the vast majority of real-world bookmarks. Rare suffixes may resolve to the
 * last two labels, which is acceptable for grouping purposes.
 */
const MULTI_PART_SUFFIXES = new Set<string>([
  // United Kingdom
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "me.uk",
  "ltd.uk",
  "plc.uk",
  "net.uk",
  "sch.uk",
  // Japan
  "co.jp",
  "or.jp",
  "ne.jp",
  "ac.jp",
  "go.jp",
  "ad.jp",
  // China
  "com.cn",
  "net.cn",
  "org.cn",
  "gov.cn",
  "edu.cn",
  "ac.cn",
  // Hong Kong / Taiwan
  "com.hk",
  "org.hk",
  "net.hk",
  "edu.hk",
  "gov.hk",
  "com.tw",
  "org.tw",
  "net.tw",
  "edu.tw",
  "gov.tw",
  // Australia
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "id.au",
  // New Zealand
  "co.nz",
  "org.nz",
  "net.nz",
  "govt.nz",
  "ac.nz",
  // Brazil
  "com.br",
  "net.br",
  "org.br",
  "gov.br",
  // India
  "co.in",
  "net.in",
  "org.in",
  "gen.in",
  "firm.in",
  // South Africa
  "co.za",
  "org.za",
  "net.za",
  "gov.za",
  // Singapore
  "com.sg",
  "net.sg",
  "org.sg",
  "edu.sg",
  "gov.sg",
  // South Korea
  "co.kr",
  "or.kr",
  "ne.kr",
  "go.kr",
  // Mexico
  "com.mx",
  "org.mx",
  "net.mx",
  "gob.mx",
  // Turkey
  "com.tr",
  "org.tr",
  "net.tr",
  "gov.tr",
  // Argentina
  "com.ar",
  "org.ar",
  "net.ar",
  "gob.ar",
  // Russia / Ukraine
  "com.ru",
  "org.ru",
  "net.ru",
  "com.ua",
  "org.ua",
  // Spain / Italy / Poland / others
  "com.es",
  "com.pl",
  "com.co",
  "com.ph",
  "com.my",
  "com.vn",
]);

/**
 * Extract the registrable domain (eTLD+1) from a full hostname using a built-in
 * multi-part suffix table. No external PSL dependency.
 *
 * Examples:
 * - `www.github.com`  -> `github.com`
 * - `gist.github.com` -> `github.com`
 * - `a.example.co.uk` -> `example.co.uk`
 * - `localhost`       -> `localhost`
 * - ``                -> ``
 */
export function registrableDomain(hostname: string): string {
  const host = (hostname || "").trim().toLowerCase().replace(/\.+$/, "");
  if (!host) return "";
  // Bare IPv4 addresses / single labels are returned as-is.
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");

  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

export interface DomainFolder {
  domain: string;
  items: BookmarkUrl[];
}

export interface DomainGrouping {
  folders: DomainFolder[];
  otherItems: BookmarkUrl[];
}

/**
 * Group bookmarks by registrable domain into a flat one-level structure.
 *
 * - Bookmarks whose domain cannot be resolved (empty registrable domain) go to
 *   `otherItems`.
 * - Domains with fewer than `minCount` bookmarks are folded into `otherItems`.
 * - `folders` are sorted by item count DESC, then domain name ASC.
 * - The caller is responsible for rendering `otherItems` last.
 */
export function groupByDomain(
  urls: BookmarkUrl[],
  opts: { minCount?: number } = {},
): DomainGrouping {
  const minCount = opts.minCount ?? DEFAULT_MIN_DOMAIN_COUNT;

  const buckets = new Map<string, BookmarkUrl[]>();
  const otherItems: BookmarkUrl[] = [];

  for (const item of urls) {
    const key = registrableDomain(item.domain);
    if (!key) {
      otherItems.push(item);
      continue;
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const folders: DomainFolder[] = [];
  for (const [domain, items] of buckets) {
    if (items.length < minCount) {
      otherItems.push(...items);
      continue;
    }
    folders.push({ domain, items });
  }

  folders.sort((a, b) => {
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    return a.domain.localeCompare(b.domain);
  });

  return { folders, otherItems };
}
