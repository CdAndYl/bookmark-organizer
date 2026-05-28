# 按域名自动分组书签

## Goal

为书签整理插件增加一种「按域名自动分组」的整理策略：不依赖规则/AI 的语义分类，而是直接根据书签 URL 的注册域名（eTLD+1），把同域名的书签归到同一个文件夹（如 `github.com`、`youtube.com`）。让用户在不配置规则、不用 AI 的情况下也能快速把杂乱书签按来源网站归类。

## Requirements

1. **新增并列整理模式**：整理页面提供「智能整理（规则/AI）」与「按域名分组」两种模式，用户每次整理时二选一。两套分类逻辑独立，复用同一套备份/移动/恢复底层。
2. **按 eTLD+1 分组**：`www.github.com`、`gist.github.com`、`github.com` 全部归到 `github.com`。
3. **eTLD+1 用内置简表启发式提取**：取主机名最后两段；命中内置多段后缀表（co.uk、com.cn、com.au 等常见几十个）时取三段。零依赖。
4. **零散域名门槛合并**：书签数低于阈值（默认 2，即只有 1 个书签的域名）的域名不单独建文件夹，统一放进「其他」文件夹。
5. **扁平一层结构**：书签栏下直接是各域名文件夹 + 「其他」，无二级目录。
6. **域名文件夹排序**：按书签数降序，数量相同按域名字母序；「其他」固定排最后。
7. **无效/空域名归「其他」**：`chrome://`、`file://`、`javascript:` 等取不到域名的书签放进「其他」。
8. **UI：模式切换 + 一个按钮**：「开始整理」旁加模式选择（智能整理 / 按域名分组），预览区随模式变化展示对应分组结果，确认弹窗文案随模式调整。
9. **复用备份机制**：整理前自动备份，可从「备份历史」恢复（与现有一致）。

## Acceptance Criteria

- [ ] 选择「按域名分组」模式整理后，同一注册域名的书签归到同一文件夹
- [ ] `www.x.com` / `sub.x.com` / `x.com` 归入同一个 `x.com` 文件夹
- [ ] `a.co.uk` / `b.co.uk` 归入 `*.co.uk` 对应注册域名而非 `co.uk`
- [ ] 只有 1 个书签的域名被并入「其他」
- [ ] 无法解析域名的书签被并入「其他」
- [ ] 整理前自动生成备份，可恢复
- [ ] 预览区在「按域名分组」模式下展示各域名/「其他」的书签数
- [ ] 「智能整理」模式行为与现状完全一致（无回归）
- [ ] 单元测试覆盖 eTLD+1 提取与分组逻辑
- [ ] lint / typecheck 通过

## Definition of Done

- 单元测试覆盖：registrableDomain 提取（含多段后缀、无效 URL）、分组与门槛合并
- Lint / typecheck 通过
- 「智能整理」旧路径无回归
- 复用现有备份/恢复，保证可回滚

## Technical Approach

- **域名提取**：新增 `registrableDomain(hostname)`，内置多段公共后缀简表，启发式取 eTLD+1。放在 `src/core/organizer/domainGroup.ts`（或 classifier 下），与现有 `domainOf` 配合。
- **分组逻辑**：新增纯函数 `groupByDomain(urls, { minCount })` → 返回 `{ folders: {domain, items}[], otherItems }`，按 Req.4/6 处理门槛与排序。便于单测。
- **整理执行**：新增 `organizeByDomain()`（`src/core/organizer/`），与 `organize()` 并列：收集 URL → 备份 → 按域名建一层文件夹 + 移动 → 删除原顶层文件夹。复用 `bookmarkTraversal` / `backup` / `bookmarks` 平台层。
- **协议**：给 `get-preview` 与 `organize-now` 增加 `mode?: "smart" | "domain"`（默认 "smart"，保持向后兼容）。`handlers.ts` 按 mode 分派。
- **结果/预览类型**：复用 `OrganizeResult` / `PreviewSnapshot`，域名模式下用 `categoryCounts` 承载「域名→数量」，`sourceCounts`/`ai` 置为 0/disabled。预览组件 `BookmarkPreview` 复用。
- **UI**：`OrganizePage.tsx` 加模式选择（segmented/radio），切换时 `refresh`，确认弹窗文案分支。

## Decision (ADR-lite)

**Context**: 现有整理只有「规则/AI 语义分类」一种策略，用户想要一种零配置、按来源网站快速归类的方式。
**Decision**:
- 集成方式 = 新增并列模式（不替换、不嵌套）
- 域名粒度 = 注册域名 eTLD+1
- eTLD+1 实现 = 内置简表启发式（零依赖，覆盖 95%+）
- 零散域名 = 门槛合并到「其他」（默认阈值 2）
- 文件夹层级 = 扁平一层
- UI = 模式切换 + 一个「开始整理」按钮
**Consequences**:
- 优点：老功能零回归、零新依赖、包体积几乎不变
- 取舍：内置简表对极少见的多段后缀可能不准（可接受，非安全相关）；阈值暂写死默认值，后续可做成可配置

## Out of Scope

- eTLD+1 阈值的 UI 可配置化（先用默认值，后续迭代）
- 引入完整 PSL 库（tldts/psl）
- 域名模式下的二级/语义归组
- 「智能整理」与「按域名分组」混合执行

## Technical Notes

- 现有域名提取：`src/core/classifier/bookmarkTraversal.ts` `domainOf()`（完整 hostname 小写）
- 整理主流程：`src/core/organizer/organize.ts`（可作为 `organizeByDomain` 的结构参考）
- 入口链路：`src/core/messaging/protocol.ts` → `src/background/handlers.ts` → `src/options/pages/OrganizePage.tsx`
- 备份/恢复与策略解耦：`src/core/organizer/backup.ts` / `restore.ts`
- 现有测试参考：`tests/ruleEngine.test.ts`
