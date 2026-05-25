import { z } from "zod";

export const MatcherSchema = z.object({
  field: z.enum(["title", "url", "domain", "path", "all"]),
  type: z.enum(["keyword", "regex", "domain-suffix"]),
  pattern: z.string().min(1),
  caseSensitive: z.boolean().optional(),
});

export const SubfolderSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  isFallback: z.boolean().optional(),
});

export const CategorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  subfolders: z.array(SubfolderSchema).min(1),
});

export const RuleSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  subfolderId: z.string().min(1),
  weight: z.number().int().min(1).max(10),
  matchers: z.array(MatcherSchema).min(1),
});

export const ThresholdsSchema = z.object({
  minPoints: z.number().int().min(1).default(4),
  highPoints: z.number().int().min(1).default(8),
  minMargin: z.number().int().min(0).default(2),
});

export const RulePackSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categories: z.array(CategorySchema).min(1),
  rules: z.array(RuleSchema),
  archiveCategoryId: z.string().min(1),
  thresholds: ThresholdsSchema.optional(),
});

export type Matcher = z.infer<typeof MatcherSchema>;
export type Subfolder = z.infer<typeof SubfolderSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type RulePack = z.infer<typeof RulePackSchema>;

export const DEFAULT_THRESHOLDS: Thresholds = {
  minPoints: 4,
  highPoints: 8,
  minMargin: 2,
};

export function validateRulePack(input: unknown): RulePack {
  const pack = RulePackSchema.parse(input);
  const categoryIds = new Set(pack.categories.map((c) => c.id));
  if (!categoryIds.has(pack.archiveCategoryId)) {
    throw new Error(
      `archiveCategoryId "${pack.archiveCategoryId}" not found in categories`,
    );
  }
  const subfolderRefs = new Map<string, Set<string>>();
  for (const cat of pack.categories) {
    subfolderRefs.set(cat.id, new Set(cat.subfolders.map((s) => s.id)));
  }
  for (const rule of pack.rules) {
    if (!categoryIds.has(rule.categoryId)) {
      throw new Error(`rule ${rule.id} references unknown categoryId ${rule.categoryId}`);
    }
    if (!subfolderRefs.get(rule.categoryId)?.has(rule.subfolderId)) {
      throw new Error(
        `rule ${rule.id} references unknown subfolderId ${rule.subfolderId} under ${rule.categoryId}`,
      );
    }
  }
  return pack;
}
