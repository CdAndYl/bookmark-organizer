# Bookmark Organizer

> 一个规则可配置的 Chrome 书签整理框架,支持可选的 AI 增强分类。
> 任何一台装有 Chrome 的电脑都可以装上即用,不需要任何外部服务。

![manifest](https://img.shields.io/badge/manifest-v3-blue) ![tech](https://img.shields.io/badge/React-18-61dafb) ![tech](https://img.shields.io/badge/TypeScript-5-3178c6) ![license](https://img.shields.io/badge/license-MIT-green)

---

## 功能

- 🗂 **规则驱动的分类** — 内置一套面向编程/AI/工具向用户的中文分类规则,开箱即用
- 🛠 **可视化规则编辑器** — 在 UI 里增删分类、子分类、关键词、权重,支持 JSON 导入导出
- 🤖 **可选 AI 增强** — 对规则无法高置信度归类的书签,送给你配置的 OpenAI 兼容接口处理(只发送标题/域名/原路径/去 query 的 URL)
- 💾 **自动备份与恢复** — 每次整理前自动备份,最多保留 5 份历史,可任意恢复
- 👁 **二次确认 + 预览树** — 整理前可视化预览整套移动计划,再点确认
- 🔒 **数据全本地** — 规则、AI Key、备份都只写入 `chrome.storage.local`,不上传任何服务器

## 截图

> TODO: 加入截图(整理页 / 规则编辑器 / AI 设置)

## 安装

### 从源码构建 + 加载

```bash
git clone https://github.com/<your-user>/bookmark-organizer.git
cd bookmark-organizer
npm install
npm run build
```

然后在 Chrome:

1. 打开 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点「加载已解压的扩展程序」
4. 选择 `dist/` 目录

完成后扩展图标会出现在地址栏右侧,点击进入配置页。

### Chrome Web Store

> TODO:上架后补充链接

## 使用流程

1. **整理页** → 查看预览树,确认即将生成的分类结构 → 点「开始整理」
2. **规则页** → 修改/导出/导入分类规则,可分享给其他人
3. **AI 页** → 填入 OpenAI 兼容接口的 Base URL + Key + 模型,选择处理范围
4. 若结果不理想 → 整理页 → 「备份历史」选一份 → 恢复

## 自定义规则

打开「规则」页:

- **左侧**:分类列表,点击切换 / 新增 / 删除
- **右侧**:分类标题、子分类、规则。每条规则可以配多个匹配器(OR 关系)
- **匹配器类型**:
  - `关键词`:逗号分隔,任一命中即触发(最常用)
  - `正则`:JavaScript 正则,适合复杂场景
  - `域名后缀`:如 `csdn.net,cnblogs.com`

修改完点「保存规则」生效,回到「整理」页可立即看到新预览。

**导出 / 导入 JSON** — 编辑好的规则集可以一键导出为文件,分享给其他人或备份。

### 规则 JSON 结构

```json
{
  "version": "1.0.0",
  "name": "我的规则",
  "archiveCategoryId": "archive",
  "thresholds": { "minPoints": 4, "highPoints": 8, "minMargin": 2 },
  "categories": [
    {
      "id": "ai",
      "title": "01 AI与自动化",
      "order": 1,
      "subfolders": [
        { "id": "ai-tools", "title": "AI工具与平台" },
        { "id": "ai-other", "title": "其他AI", "isFallback": true }
      ]
    }
  ],
  "rules": [
    {
      "id": "rule-ai-tools",
      "categoryId": "ai",
      "subfolderId": "ai-tools",
      "weight": 5,
      "matchers": [
        { "field": "all", "type": "keyword", "pattern": "chatgpt,openai,claude" }
      ]
    }
  ]
}
```

完整 schema 见 `src/core/classifier/ruleSchema.ts`。

## 数据隐私

- 所有数据保存在 `chrome.storage.local`,不会上传到任何服务器。
- 启用 AI 时,仅发送以下字段给你配置的接口:
  - `title` 书签标题
  - `domain` 域名
  - `path` 原文件夹路径
  - `safeUrl` URL(已去除 query 和 hash)
- 不发送:完整 URL、Cookie、浏览历史、其他任何浏览器数据。
- API Key 仅写入 `chrome.storage.local`,卸载扩展即清除。

## 开发

```bash
npm install            # 装依赖
npm run dev            # Vite 开发模式(可热更新)
npm run build          # 生产构建到 dist/
npm run typecheck      # TypeScript 类型检查
npm test               # Vitest 单测
npm run pack           # 打包 dist/ 为 release/ zip (用于上架)
```

### 项目结构

```
bookmark-organizer/
├── public/
│   └── default-rules.json    # 默认规则集
├── src/
│   ├── background/           # MV3 service worker + 消息路由
│   ├── options/              # React 配置页(4 个 Tab)
│   ├── core/
│   │   ├── classifier/       # 规则引擎(算法 + schema)
│   │   ├── organizer/        # 整理 / 恢复 / 备份 / 并发锁
│   │   ├── ai/               # OpenAI 兼容客户端 + prompt
│   │   └── messaging/        # 后台 ↔ UI 类型化协议
│   ├── platform/             # chrome.* API 抽象层
│   └── shared/               # 跨模块的类型定义
├── tests/                    # Vitest 单测
└── scripts/                  # 构建脚本
```

## 路线图

- [ ] 截图与演示视频
- [ ] Edge / Firefox 兼容
- [ ] Chrome Web Store 上架
- [ ] 在线规则市场(社区分享规则集)
- [ ] AI 提示词自定义模板

## 贡献

欢迎 PR。开发前请先开 Issue 讨论方向。

## License

[MIT](./LICENSE)
