import type { BookmarkUrl } from "@/shared/types";
import {
  DEFAULT_THRESHOLDS,
  type Matcher,
  type Rule,
  type RulePack,
} from "./ruleSchema";

export interface Classification {
  categoryId: string;
  subfolderId: string;
  confidence: "high" | "medium" | "low";
  points: number;
  margin: number;
  source: "rule" | "ai";
  matchedRules: string[];
}

interface CategoryScore {
  points: number;
  subfolderId: string | null;
  subfolderPoints: number;
  matchedRules: string[];
}

export function classify(item: BookmarkUrl, pack: RulePack): Classification {
  const thresholds = pack.thresholds ?? DEFAULT_THRESHOLDS;
  const scores = new Map<string, CategoryScore>();

  for (const rule of pack.rules) {
    if (!ruleMatches(rule, item)) continue;
    addScore(scores, rule);
  }

  const fallbackSubfolderOf = buildFallbackMap(pack);
  const ranked = [...scores.entries()]
    .map<[string, CategoryScore]>(([cid, s]) => [
      cid,
      {
        ...s,
        subfolderId: s.subfolderId ?? fallbackSubfolderOf.get(cid) ?? null,
      },
    ])
    .sort((a, b) => b[1].points - a[1].points);

  if (ranked.length === 0 || ranked[0][1].points < thresholds.minPoints) {
    return archiveClassification(pack, ranked[0]?.[1].points ?? 0, 0);
  }

  const [topId, topScore] = ranked[0];
  const second = ranked[1];
  const margin = second ? topScore.points - second[1].points : topScore.points;
  if (
    second &&
    margin < thresholds.minMargin &&
    topScore.points < thresholds.highPoints
  ) {
    return archiveClassification(pack, topScore.points, margin);
  }

  const subfolderId = topScore.subfolderId ?? fallbackSubfolderOf.get(topId);
  if (!subfolderId) {
    return archiveClassification(pack, topScore.points, margin);
  }

  return {
    categoryId: topId,
    subfolderId,
    confidence: topScore.points >= thresholds.highPoints ? "high" : "medium",
    points: topScore.points,
    margin,
    source: "rule",
    matchedRules: topScore.matchedRules,
  };
}

function addScore(scores: Map<string, CategoryScore>, rule: Rule): void {
  const existing = scores.get(rule.categoryId) ?? {
    points: 0,
    subfolderId: null,
    subfolderPoints: 0,
    matchedRules: [],
  };
  existing.points += rule.weight;
  existing.matchedRules.push(rule.id);
  if (rule.weight >= 4 && rule.weight > existing.subfolderPoints) {
    existing.subfolderId = rule.subfolderId;
    existing.subfolderPoints = rule.weight;
  } else if (existing.subfolderId === null) {
    existing.subfolderId = rule.subfolderId;
    existing.subfolderPoints = rule.weight;
  }
  scores.set(rule.categoryId, existing);
}

function archiveClassification(
  pack: RulePack,
  points: number,
  margin: number,
): Classification {
  const archive = pack.categories.find((c) => c.id === pack.archiveCategoryId);
  const fallback =
    archive?.subfolders.find((s) => s.isFallback) ?? archive?.subfolders[0];
  if (!archive || !fallback) {
    throw new Error("Rule pack missing archive category or fallback subfolder");
  }
  return {
    categoryId: archive.id,
    subfolderId: fallback.id,
    confidence: "low",
    points,
    margin,
    source: "rule",
    matchedRules: [],
  };
}

function buildFallbackMap(pack: RulePack): Map<string, string> {
  const map = new Map<string, string>();
  for (const cat of pack.categories) {
    const fallback =
      cat.subfolders.find((s) => s.isFallback) ??
      cat.subfolders[cat.subfolders.length - 1];
    if (fallback) map.set(cat.id, fallback.id);
  }
  return map;
}

function ruleMatches(rule: Rule, item: BookmarkUrl): boolean {
  return rule.matchers.some((m) => matcherMatches(m, item));
}

function matcherMatches(matcher: Matcher, item: BookmarkUrl): boolean {
  const subjectRaw = subjectOf(matcher.field, item);
  const subject = matcher.caseSensitive ? subjectRaw : subjectRaw.toLowerCase();
  const pattern = matcher.caseSensitive
    ? matcher.pattern
    : matcher.pattern.toLowerCase();

  switch (matcher.type) {
    case "keyword":
      return pattern
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .some((kw) => subject.includes(kw));
    case "regex": {
      try {
        const re = new RegExp(matcher.pattern, matcher.caseSensitive ? "" : "i");
        return re.test(subjectRaw);
      } catch {
        return false;
      }
    }
    case "domain-suffix": {
      const suffixes = pattern
        .split(",")
        .map((s) => s.trim().replace(/^\./, ""))
        .filter(Boolean);
      const domain = item.domain;
      return suffixes.some(
        (s) => domain === s || domain.endsWith(`.${s}`),
      );
    }
  }
}

function subjectOf(
  field: Matcher["field"],
  item: BookmarkUrl,
): string {
  switch (field) {
    case "title":
      return item.title || "";
    case "url":
      return item.url || "";
    case "domain":
      return item.domain || "";
    case "path":
      return item.path || "";
    case "all":
      return `${item.path} ${item.title || ""} ${item.url || ""} ${item.domain}`;
  }
}

export interface ClassifyOptions {
  pack: RulePack;
}

export function classifyAll(
  items: BookmarkUrl[],
  pack: RulePack,
): Map<string, Classification> {
  const out = new Map<string, Classification>();
  for (const item of items) {
    out.set(item.id, classify(item, pack));
  }
  return out;
}
