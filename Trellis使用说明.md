# Trellis 使用说明

> 本文档基于本项目实际安装情况编写（CLI v0.5.19，平台：Claude Code，开发者：`Jons_snow`）。
> Trellis 是一个团队 AI 编码工作流框架：把「规范（spec）、任务（task）、工作流（workflow）、项目记忆（journal）」固化成文件，让 AI 在每次会话里都按同一套流程干活。

---

## 1. 安装内容（本项目现状）

- **全局 CLI**：`@mindfoldhq/trellis`（用 `trellis --version` 查看，当前 0.5.19）
- **平台集成**：仅启用了 Claude Code（`trellis init --claude`）
- **生成的目录/文件**：

```
项目根/
├── AGENTS.md                 # AI 助手指令入口（被 Trellis 托管的区块 + 你的自定义区块）
├── .trellis/                 # 框架核心
│   ├── workflow.md           # 三阶段工作流完整指南（最重要）
│   ├── config.yaml           # 项目级配置
│   ├── .developer            # 当前开发者身份（gitignore）
│   ├── spec/                 # 编码规范（按 package/layer 组织）
│   ├── tasks/                # 进行中的任务（每个任务一个目录）
│   ├── workspace/Jons_snow/  # 你的个人 journal / 会话记录
│   └── scripts/              # task.py / get_context.py 等 Python 脚本
└── .claude/                  # Claude Code 集成
    ├── settings.json         # 注册了 3 个 hook（见下文）
    ├── hooks/                # session-start / inject-workflow-state / inject-subagent-context
    ├── commands/trellis/     # 斜杠命令：/trellis:continue、/trellis:finish-work
    ├── agents/               # 子代理：trellis-implement / trellis-check / trellis-research
    └── skills/               # 技能：brainstorm / check / update-spec 等 7 个
```

---

## 2. 环境与 Windows 注意事项

- **Python**：本机 `python` = 真正的 Python 3.12.10（可用）；`python3` 是无效的 Windows 应用商店占位符。Trellis 已自动用 `python` 生成所有 hook 和脚本调用，**无需改动**。文档里命令一律用 `python`。
- **`trellis init` 会卡在交互式模板选择**：在非交互终端里直接运行 `trellis init` 会因为 readline 崩溃。解决办法是加 `-y`（用默认 "from scratch" 模板，跳过所有交互）：
  ```bash
  trellis init --claude -u <你的名字> -y
  ```
- **代理**：init 时检测到 `http://127.0.0.1:10808/` 代理用于拉取模板，属正常。

---

## 3. Hook 机制（自动注入，无需手动触发）

`.claude/settings.json` 注册了 3 个 hook，**下次启动 Claude Code 会话时自动生效**：

| 事件 | 脚本 | 作用 |
|---|---|---|
| `SessionStart`（startup/clear/compact） | `session-start.py` | 会话开始时注入：开发者身份、git 状态、当前任务、active tasks、spec 索引、workflow 目录 |
| `UserPromptSubmit` | `inject-workflow-state.py` | 每轮对话注入 `<workflow-state>` 面包屑，告诉 AI 现在处于哪个阶段、该做什么 |
| `PreToolUse`（Task/Agent） | `inject-subagent-context.py` | 派发子代理时，把任务上下文（prd、spec）注入子代理 |

> 关键：你不需要手动跑这些 hook。它们让 AI 每轮都「记得」当前流程状态。

---

## 4. 五条核心原则

1. **先规划再写码** — 动手前先想清楚做什么
2. **规范靠注入，不靠记忆** — 编码规范通过 hook/skill 注入，而非让 AI「凭印象」
3. **一切落盘** — 调研、决策、经验都写进文件；对话会被压缩，文件不会
4. **增量开发** — 一次只做一个任务
5. **沉淀经验** — 每个任务结束后，把新知识写回 spec

---

## 5. 三阶段工作流

```
Phase 1: Plan    → 想清楚做什么（头脑风暴 + 调研 → prd.md）
Phase 2: Execute → 写代码并通过质量检查
Phase 3: Finish  → 沉淀经验 + 收尾
```

### Phase 1：Plan（规划）
1. **1.0 创建任务**：`python ./.trellis/scripts/task.py create "<标题>" --slug <名字>`（状态进入 `planning`）
   - ⚠️ 这一步只跑 `create`，**别跑 `start`**（`start` 会过早切到实现阶段）
2. **1.1 需求探索**：加载 `trellis-brainstorm` 技能，与你一问一答地把需求写进 `prd.md`
3. **1.2 调研（可选）**：派发 `trellis-research` 子代理，结果写进 `{任务目录}/research/`
4. **1.3 配置上下文**：整理 `implement.jsonl` 和 `check.jsonl`，列出子代理需要的 spec/research 文件
5. **1.4 激活任务**：`python ./.trellis/scripts/task.py start <任务目录>`（状态 → `in_progress`）

### Phase 2：Execute（执行）
- **2.1 实现**：派发 `trellis-implement` 子代理写代码（主会话默认不直接写码）
- **2.2 质量检查**：派发 `trellis-check` 子代理对照 spec/prd 审查并修复，跑 lint/type-check
- **2.3 回滚（按需）**：发现 prd 有缺陷就回 Phase 1 改，再重做

### Phase 3：Finish（收尾）
- **3.1 最终验证**：加载 `trellis-check` 做最后检查（lint/type-check/tests 全绿）
- **3.2 调试复盘（按需）**：反复修同一个 bug 时加载 `trellis-break-loop`
- **3.3 更新 spec**：加载 `trellis-update-spec`，把新模式/坑/技术决策写回 `.trellis/spec/`
- **3.4 提交代码**：AI 给出分组提交计划 → 你确认 → 执行 `git commit`（不 amend、不 push）
- **3.5 收尾**：运行 `/trellis:finish-work` 归档任务 + 记录会话

> `/finish-work` 在工作区有未提交改动（`.trellis/workspace/` 和 `.trellis/tasks/` 之外）时会拒绝运行，所以必须先完成 3.4 提交。

---

## 6. 在 Claude Code 里怎么用（日常）

最自然的用法是**直接说你的需求**，AI 会按 workflow-state 面包屑自动走流程。几种典型场景：

| 你想做的事 | 直接说 / 用什么 |
|---|---|
| 加新功能、需求还不清晰 | 直接描述需求，AI 会创建任务并加载 `trellis-brainstorm` |
| 继续上次没做完的任务 | `/trellis:continue` |
| 任务做完了要收尾 | `/trellis:finish-work` |
| 只是问问题 / 查代码 / 小聊 | 直接问，AI 走「直接回答」不建任务 |
| 这次只想小修一下、不走完整流程 | 在消息里写「**跳过 trellis**」「**直接改**」「**小修一下**」「**别走流程**」之一 |
| 想让主会话直接改、不派子代理 | 在消息里写「**你直接改**」「**不用 sub-agent**」之一 |

> 注意：默认情况下，凡是「写代码 / 改代码 / 重构」类工作，AI 会先建任务走流程。只有你的当前消息里明确包含上面的「跳过」口令，它才会内联直接改——它不会自己擅自跳过。

---

## 7. 任务命令速查（task.py）

```bash
# 生命周期
python ./.trellis/scripts/task.py create "<标题>" [--slug <名字>] [--parent <目录>]
python ./.trellis/scripts/task.py start <名字>        # 设为活动任务，状态→in_progress
python ./.trellis/scripts/task.py current --source    # 看当前活动任务及来源
python ./.trellis/scripts/task.py finish              # 清除活动任务指针（状态不变）
python ./.trellis/scripts/task.py archive <名字>      # 归档到 archive/{年-月}/，状态→completed
python ./.trellis/scripts/task.py list [--mine] [--status <状态>]
python ./.trellis/scripts/task.py list-archive

# 上下文（注入给 implement/check 子代理）
python ./.trellis/scripts/task.py add-context <名字> <implement|check> <文件> <理由>
python ./.trellis/scripts/task.py list-context <名字> [action]
python ./.trellis/scripts/task.py validate <名字>

# 元数据
python ./.trellis/scripts/task.py set-branch <名字> <分支>
python ./.trellis/scripts/task.py set-base-branch <名字> <分支>   # PR 目标分支
python ./.trellis/scripts/task.py set-scope <名字> <范围>

# 父子任务
python ./.trellis/scripts/task.py add-subtask <父> <子>
python ./.trellis/scripts/task.py remove-subtask <父> <子>
```

> `--slug` 只写人类可读名字，**不要带 `MM-DD-` 日期前缀**，脚本会自动加。
> 随时用 `python ./.trellis/scripts/task.py --help` 看最新最权威的命令列表。

---

## 8. 其他常用脚本

```bash
# 看当前会话完整运行时上下文
python ./.trellis/scripts/get_context.py

# 列出所有 package 及其 spec 层（整理 jsonl 时用来找规范文件）
python ./.trellis/scripts/get_context.py --mode packages

# 查看某个工作流步骤的详细指引
python ./.trellis/scripts/get_context.py --mode phase --step 1.1

# 记录一次会话到个人 journal
python ./.trellis/scripts/add_session.py --title "标题" --commit "<hash>" --summary "摘要"

# 初始化开发者身份（已做过，新人加入时用）
python ./.trellis/scripts/init_developer.py <名字>
```

---

## 9. Spec / Skills / Agents

- **Spec（`.trellis/spec/`）**：按 package/layer 组织的编码规范。每层有 `index.md`（含 Pre-Development Checklist + Quality Check）。本项目当前 spec 层：`frontend`。何时更新：发现新模式/约定、要固化某个 bug 的预防措施、有新技术决策时。
- **Skills（`.claude/skills/`）**：`trellis-brainstorm`（需求探索）、`trellis-before-dev`（写码前读规范）、`trellis-check`（质量检查）、`trellis-update-spec`（更新规范）、`trellis-break-loop`（跳出反复 debug）、`trellis-spec-bootstarp`、`trellis-meta`。
- **Agents（`.claude/agents/`，通过 Task/Agent 工具派发）**：`trellis-implement`（写码）、`trellis-check`（审查+修复）、`trellis-research`（调研）。

> 注意区分：`trellis-implement` / `trellis-research` 只是**子代理类型**（用 Task/Agent 工具派发），不是 skill；`trellis-update-spec` 是 skill；`trellis-check` 两者都有，验证代码时优先用子代理形式。

---

## 10. CLI 命令

```bash
trellis init [选项] -u <名字> -y    # 在当前项目初始化（-y 跳过交互）
trellis update                       # 更新 Trellis 配置/命令到最新版（会按区块替换托管内容）
trellis uninstall                    # 移除本项目所有 Trellis 文件（平台文件 + .trellis/）
trellis --version
trellis --help
```

> 想给其它平台也生成命令，重跑 init 时加对应 flag，如 `--cursor --copilot`。

---

## 11. 一个完整的日常示例

```text
你：帮我给书签整理插件加一个「按域名自动分组」的功能
AI：（创建任务 task.py create "按域名自动分组书签"，状态=planning）
    （加载 trellis-brainstorm，一问一答确认需求，写进 prd.md）
    （需要时派发 trellis-research 调研，结果写进 research/）
    （整理 implement.jsonl / check.jsonl，列出相关 spec）
    （task.py start，状态→in_progress）
    （派发 trellis-implement 写代码）
    （派发 trellis-check 审查 + 跑 lint/type-check）
    （加载 trellis-update-spec，把新约定写回 spec）
    （给出提交计划，你回「行」后 git commit）
你：/trellis:finish-work
AI：（归档任务 + 记录本次会话到 journal）
```

---

## 12. 提示

- 这些新文件（`.claude/`、`.trellis/`、`AGENTS.md`、本说明）目前是未提交状态，需要时用 git 提交进版本库，团队成员 clone 后即可共享同一套流程。
- 想深入定制工作流（改某个步骤的含义、加自定义状态），编辑 `.trellis/workflow.md`，脚本只是解析器。详见该文件末尾「Customizing Trellis」一节。
