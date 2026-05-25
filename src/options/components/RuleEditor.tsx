import { useMemo, useState } from "react";
import type {
  Category,
  Matcher,
  Rule,
  RulePack,
  Subfolder,
} from "@/core/classifier/ruleSchema";

interface Props {
  pack: RulePack;
  onChange: (next: RulePack) => void;
  dirty: boolean;
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const MATCHER_FIELDS: { value: Matcher["field"]; label: string }[] = [
  { value: "all", label: "标题+域名+路径+URL(默认)" },
  { value: "title", label: "仅标题" },
  { value: "url", label: "仅 URL" },
  { value: "domain", label: "仅域名" },
  { value: "path", label: "仅原文件夹路径" },
];

const MATCHER_TYPES: { value: Matcher["type"]; label: string; hint: string }[] = [
  { value: "keyword", label: "关键词", hint: "逗号分隔,任一命中即触发" },
  { value: "regex", label: "正则", hint: "JavaScript 正则语法" },
  { value: "domain-suffix", label: "域名后缀", hint: "如 csdn.net,逗号分隔" },
];

export function RuleEditor({ pack, onChange, dirty }: Props) {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    () => pack.categories[0]?.id ?? "",
  );
  const selectedCat = useMemo(
    () => pack.categories.find((c) => c.id === selectedCatId) ?? null,
    [pack.categories, selectedCatId],
  );
  const rulesOfCat = useMemo(
    () => pack.rules.filter((r) => r.categoryId === selectedCatId),
    [pack.rules, selectedCatId],
  );

  function updateCategory(catId: string, patch: Partial<Category>) {
    onChange({
      ...pack,
      categories: pack.categories.map((c) =>
        c.id === catId ? { ...c, ...patch } : c,
      ),
    });
  }

  function addCategory() {
    const title = prompt("新分类名称(如 07 我的收藏)?")?.trim();
    if (!title) return;
    const id = uniqueId(slug(title) || "cat", pack.categories.map((c) => c.id));
    const fallbackId = uniqueId(`${id}-other`, []);
    const next: Category = {
      id,
      title,
      order: pack.categories.length + 1,
      subfolders: [{ id: fallbackId, title: "其他", isFallback: true }],
    };
    onChange({ ...pack, categories: [...pack.categories, next] });
    setSelectedCatId(id);
  }

  function deleteCategory(catId: string) {
    if (catId === pack.archiveCategoryId) {
      alert("不能删除归档分类");
      return;
    }
    if (!confirm("删除该分类?指向它的规则也会被一并删除。")) return;
    const nextCats = pack.categories.filter((c) => c.id !== catId);
    const nextRules = pack.rules.filter((r) => r.categoryId !== catId);
    onChange({ ...pack, categories: nextCats, rules: nextRules });
    if (selectedCatId === catId) setSelectedCatId(nextCats[0]?.id ?? "");
  }

  function addSubfolder() {
    if (!selectedCat) return;
    const title = prompt("子分类名称?")?.trim();
    if (!title) return;
    const id = uniqueId(
      `${selectedCat.id}-${slug(title) || "sub"}`,
      selectedCat.subfolders.map((s) => s.id),
    );
    updateCategory(selectedCat.id, {
      subfolders: [...selectedCat.subfolders, { id, title }],
    });
  }

  function updateSubfolder(subId: string, patch: Partial<Subfolder>) {
    if (!selectedCat) return;
    updateCategory(selectedCat.id, {
      subfolders: selectedCat.subfolders.map((s) =>
        s.id === subId ? { ...s, ...patch } : s,
      ),
    });
  }

  function deleteSubfolder(subId: string) {
    if (!selectedCat) return;
    if (selectedCat.subfolders.length <= 1) {
      alert("至少要保留一个子分类");
      return;
    }
    if (!confirm("删除该子分类?指向它的规则也会被一并删除。")) return;
    const nextSubs = selectedCat.subfolders.filter((s) => s.id !== subId);
    const nextRules = pack.rules.filter(
      (r) => !(r.categoryId === selectedCat.id && r.subfolderId === subId),
    );
    onChange({
      ...pack,
      categories: pack.categories.map((c) =>
        c.id === selectedCat.id ? { ...c, subfolders: nextSubs } : c,
      ),
      rules: nextRules,
    });
  }

  function updateRule(ruleId: string, patch: Partial<Rule>) {
    onChange({
      ...pack,
      rules: pack.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    });
  }

  function deleteRule(ruleId: string) {
    if (!confirm("删除该规则?")) return;
    onChange({ ...pack, rules: pack.rules.filter((r) => r.id !== ruleId) });
  }

  function addRule() {
    if (!selectedCat) return;
    const newRule: Rule = {
      id: uniqueId(`rule-${slug(selectedCat.id)}`, pack.rules.map((r) => r.id)),
      categoryId: selectedCat.id,
      subfolderId: selectedCat.subfolders[0].id,
      weight: 5,
      matchers: [{ field: "all", type: "keyword", pattern: "" }],
    };
    onChange({ ...pack, rules: [...pack.rules, newRule] });
  }

  function updateMatcher(rule: Rule, idx: number, patch: Partial<Matcher>) {
    const next = rule.matchers.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    updateRule(rule.id, { matchers: next });
  }

  function deleteMatcher(rule: Rule, idx: number) {
    if (rule.matchers.length <= 1) {
      alert("至少要保留一个匹配器");
      return;
    }
    updateRule(rule.id, {
      matchers: rule.matchers.filter((_, i) => i !== idx),
    });
  }

  function addMatcher(rule: Rule) {
    updateRule(rule.id, {
      matchers: [...rule.matchers, { field: "all", type: "keyword", pattern: "" }],
    });
  }

  return (
    <div className="rule-editor">
      {dirty && (
        <div className="rule-editor-dirty">未保存的改动 — 别忘了点上方的「保存规则」</div>
      )}
      <div className="rule-editor-layout">
        <aside className="rule-editor-sidebar">
          <header className="sidebar-header">
            <h3>分类</h3>
            <button type="button" className="btn btn--ghost" onClick={addCategory}>
              + 分类
            </button>
          </header>
          <ul className="cat-list">
            {pack.categories.map((c) => (
              <li
                key={c.id}
                className={`cat-list-item${selectedCatId === c.id ? " cat-list-item--active" : ""}`}
                onClick={() => setSelectedCatId(c.id)}
              >
                <span className="cat-title">{c.title}</span>
                <span className="cat-meta">
                  {pack.rules.filter((r) => r.categoryId === c.id).length} 规则
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="rule-editor-main">
          {!selectedCat ? (
            <p className="muted">选择左侧分类开始编辑</p>
          ) : (
            <>
              <div className="cat-editor">
                <div className="field">
                  <span className="field-label">分类标题</span>
                  <input
                    type="text"
                    value={selectedCat.title}
                    onChange={(e) =>
                      updateCategory(selectedCat.id, { title: e.target.value })
                    }
                  />
                </div>
                <div className="cat-editor-actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--danger-text"
                    onClick={() => deleteCategory(selectedCat.id)}
                  >
                    删除该分类
                  </button>
                </div>
              </div>

              <div className="sub-editor">
                <header className="section-header" style={{ marginTop: 12 }}>
                  <h3>子分类 ({selectedCat.subfolders.length})</h3>
                  <button type="button" className="btn btn--ghost" onClick={addSubfolder}>
                    + 子分类
                  </button>
                </header>
                <ul className="sub-list">
                  {selectedCat.subfolders.map((s) => (
                    <li key={s.id} className="sub-item">
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => updateSubfolder(s.id, { title: e.target.value })}
                      />
                      <label className="checkbox-line" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(s.isFallback)}
                          onChange={(e) =>
                            updateSubfolder(s.id, { isFallback: e.target.checked })
                          }
                        />
                        作为兜底
                      </label>
                      <button
                        type="button"
                        className="btn btn--ghost btn--danger-text"
                        onClick={() => deleteSubfolder(s.id)}
                      >
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rules-section">
                <header className="section-header" style={{ marginTop: 16 }}>
                  <h3>规则 ({rulesOfCat.length})</h3>
                  <button type="button" className="btn btn--ghost" onClick={addRule}>
                    + 规则
                  </button>
                </header>
                {rulesOfCat.length === 0 && (
                  <p className="muted">该分类暂无规则。书签只会通过其他分类间接归类。</p>
                )}
                {rulesOfCat.map((rule) => (
                  <div key={rule.id} className="rule-card">
                    <div className="rule-card-head">
                      <select
                        value={rule.subfolderId}
                        onChange={(e) => updateRule(rule.id, { subfolderId: e.target.value })}
                      >
                        {selectedCat.subfolders.map((s) => (
                          <option key={s.id} value={s.id}>
                            归入:{s.title}
                          </option>
                        ))}
                      </select>
                      <label className="rule-weight">
                        权重
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={rule.weight}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              weight: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn--ghost btn--danger-text"
                        onClick={() => deleteRule(rule.id)}
                      >
                        删除
                      </button>
                    </div>
                    <div className="matcher-list">
                      {rule.matchers.map((m, idx) => (
                        <div key={idx} className="matcher-row">
                          <select
                            value={m.field}
                            onChange={(e) =>
                              updateMatcher(rule, idx, {
                                field: e.target.value as Matcher["field"],
                              })
                            }
                          >
                            {MATCHER_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={m.type}
                            onChange={(e) =>
                              updateMatcher(rule, idx, {
                                type: e.target.value as Matcher["type"],
                              })
                            }
                          >
                            {MATCHER_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={m.pattern}
                            placeholder={
                              MATCHER_TYPES.find((t) => t.value === m.type)?.hint
                            }
                            onChange={(e) =>
                              updateMatcher(rule, idx, { pattern: e.target.value })
                            }
                          />
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => deleteMatcher(rule, idx)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => addMatcher(rule)}
                      >
                        + 匹配器
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function uniqueId(seed: string, existing: string[]): string {
  if (!existing.includes(seed)) return seed;
  let i = 2;
  while (existing.includes(`${seed}-${i}`)) i += 1;
  return `${seed}-${i}`;
}
