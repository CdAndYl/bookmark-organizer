import { useMemo, useState } from "react";
import type { MovePlanEntry, PreviewSnapshot } from "@/shared/types";

interface Props {
  snapshot: PreviewSnapshot;
}

interface CategoryGroup {
  categoryTitle: string;
  total: number;
  subfolders: Map<string, MovePlanEntry[]>;
}

function groupPlan(plan: MovePlanEntry[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const entry of plan) {
    let group = groups.get(entry.toCategoryTitle);
    if (!group) {
      group = {
        categoryTitle: entry.toCategoryTitle,
        total: 0,
        subfolders: new Map(),
      };
      groups.set(entry.toCategoryTitle, group);
    }
    group.total += 1;
    const arr = group.subfolders.get(entry.toSubfolderTitle) ?? [];
    arr.push(entry);
    group.subfolders.set(entry.toSubfolderTitle, arr);
  }
  return [...groups.values()].sort((a, b) =>
    a.categoryTitle.localeCompare(b.categoryTitle),
  );
}

export function BookmarkPreview({ snapshot }: Props) {
  const groups = useMemo(() => groupPlan(snapshot.movePlan), [snapshot.movePlan]);
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set());
  const [expandedSub, setExpandedSub] = useState<Set<string>>(new Set());

  function toggleCat(name: string) {
    const next = new Set(expandedCat);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedCat(next);
  }

  function toggleSub(key: string) {
    const next = new Set(expandedSub);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedSub(next);
  }

  if (groups.length === 0) {
    return <p className="muted">没有可整理的书签。</p>;
  }

  return (
    <div className="tree">
      {groups.map((g) => {
        const open = expandedCat.has(g.categoryTitle);
        return (
          <div key={g.categoryTitle} className="tree-node">
            <button
              type="button"
              className="tree-row tree-row--cat"
              onClick={() => toggleCat(g.categoryTitle)}
            >
              <span className="tree-caret">{open ? "▾" : "▸"}</span>
              <span className="tree-title">{g.categoryTitle}</span>
              <span className="tree-count">{g.total}</span>
            </button>
            {open && (
              <div className="tree-children">
                {[...g.subfolders.entries()]
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([subName, items]) => {
                    const subKey = `${g.categoryTitle}/${subName}`;
                    const subOpen = expandedSub.has(subKey);
                    return (
                      <div key={subKey} className="tree-node">
                        <button
                          type="button"
                          className="tree-row tree-row--sub"
                          onClick={() => toggleSub(subKey)}
                        >
                          <span className="tree-caret">{subOpen ? "▾" : "▸"}</span>
                          <span className="tree-title">{subName || "全部"}</span>
                          <span className="tree-count">{items.length}</span>
                        </button>
                        {subOpen && (
                          <ul className="tree-leafs">
                            {items.slice(0, 100).map((entry) => (
                              <li key={entry.bookmarkId} className="leaf">
                                <span className={`badge badge--${entry.confidence}`}>
                                  {entry.confidence}
                                </span>
                                <span className="leaf-title" title={entry.url}>
                                  {entry.title}
                                </span>
                                <span className="leaf-domain">
                                  {hostnameOf(entry.url)}
                                </span>
                              </li>
                            ))}
                            {items.length > 100 && (
                              <li className="leaf leaf--more">
                                ...另有 {items.length - 100} 条未显示
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
