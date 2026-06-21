# 子目录作为类别标签筛选 — 设计文档

日期：2026-06-22
状态：已确认设计，待写实现计划

## 1. 目标

读取插件配置 `srcDir` 下的子目录结构，把每层目录名作为图标的标签（tags）。在客户端 UI 的 Header 工具栏新增一个「分类」下拉（Popover），**单选**某个标签即可筛选下方图标网格。

本功能是叠加在现有「搜索 → 排序 → issuesOnly」管线之上的一层过滤，不改变现有任意一项的行为。

### 非目标（YAGNI）
- 不做多选筛选（确认为单选）。
- 不为根级（无子目录）图标提供「未分类」筛选项（确认不提供）—— 根级图标只在「全部」下出现。
- 不做标签的层级树形展示；每层目录都摊平成一个独立的扁平标签。
- 不新增任何传输通道；复用现有 WebSocket payload。

## 2. 标签语义（已确认）

- **每层目录都作为独立标签。** `srcDir/social/brands/x.svg` → `tags: ['social', 'brands']`。
- 根级文件 `srcDir/x.svg` → `tags: []`。
- **单选筛选**：选中标签 `T` 时，显示所有 `tags` 包含 `T` 的图标。因此选中 `social` 会同时显示 `social/x.svg` 与 `social/brands/x.svg`；选中 `brands` 显示 `social/brands/x.svg`。`全部`（`selectedTag === null`）显示所有图标。
- **标签计数基于全量图标列表**（`list`），与当前搜索/筛选无关，行为稳定可预期。

## 3. 关键架构决策：标签在 Node 端派生

客户端 `IconDataItem.relativePath` 是相对**项目根目录**计算的（`src/node/fontsGenerator.ts:86`，`relative(root, absolutePath)`），不是相对 `srcDir`。因此客户端无法从 `relativePath` 可靠还原 `srcDir` 下的子目录（首段是 `demo` 之类的根级目录）。`id`（如 `social-brands-x`）同样无法区分「目录分隔符 `-`」与「图标名中的 `-`」。

`srcDir` 只在 Node 端已知，所以标签必须在 Node 端计算并随现有数据下发。

## 4. 数据模型变更

`src/types.ts` 的 `IconDataItem` 新增字段：

```ts
export interface IconDataItem {
  id: string
  useId: string
  svg: string
  svgBody: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  tags: string[] // 新增：srcDir 下从外到内的每层目录名；根级图标为 []
}
```

`tags` 为必填（Node 端总是写入），客户端 `_IconDataItem extends IconDataItem` 自动继承。

## 5. Node 端实现（`src/node/fontsGenerator.ts`）

新增纯函数（便于单测）：

```ts
import { relative, dirname, sep } from 'node:path'

/** 从 srcDir 到文件绝对路径，取目录部分按层切分为标签；根级文件返回 [] */
export function getTagsFromPath(srcDir: string, absolutePath: string): string[] {
  const rel = relative(srcDir, absolutePath)
  const dir = dirname(rel)
  if (dir === '.' || dir === '' || dir.startsWith('..')) return []
  return dir.split(/[\\/]/).filter(Boolean)
}
```

在 `Object.values(assets).map(({ absolutePath, id }) => { ... })`（约 `fontsGenerator.ts:68-89`）返回的对象中加入：

```ts
return {
  id,
  useId: `${prefix}-${id}`,
  absolutePath,
  svg: svgContent,
  svgBody: svgBody,
  relativePath: relative(root, absolutePath),
  lastModified: statSync(absolutePath).mtime,
  tags: getTagsFromPath(srcDir, absolutePath) // 新增
}
```

`srcDir` 已在闭包内可用（`fontsGenerator.ts:16`）。传输复用现有 `vite-plugin-supericon:update` WebSocket payload，无需改动 `rpc.ts` / `index.ts`。

## 6. 客户端状态与筛选

新建 `src/client/logic/state/tags.ts`（遵循 `state/dispaly.ts` 的状态拆分约定）：

```ts
import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { list } from '../state'

// 单选；null 表示「全部」
export const selectedTag = useStorage<string | null>('vite-supericon:selected-tag', null)

// 基于全量 list 统计的标签 → 计数，按名排序
export const availableTags = computed<{ name: string; count: number }[]>(() => {
  const counts = new Map<string, number>()
  for (const item of list.value) {
    for (const tag of item.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
})
```

在 `src/client/logic/state.ts` 的 `sortedSearchResults`（`state.ts:49-64`）过滤管线中，于 `issuesOnly` 之后、排序之前插入一步：

```ts
import { selectedTag } from './state/tags'
// ...
if (selectedTag.value) {
  results = results.filter((i) => i.tags?.includes(selectedTag.value!))
}
```

**HMR 健壮性**：在 `tags.ts` 加一个 watcher——当 `selectedTag` 非空且不在 `availableTags` 的名字集合中（目录被删/改名后）时，重置为 `null`，避免出现无解释的空网格。

## 7. UI：Header 分类下拉（`src/client/views/Header.vue`）

- 在排序 Popover 旁新增「分类 ▾」触发按钮，**完全复用现有 `.pop-trigger` / `.pop-card` 样式与 Naive UI Popover 模式**（与排序/尺寸/密度一致）。
- 面板内为单选列表：第一项 `全部`（设 `selectedTag = null`），其后是 `availableTags` 的每一项 `名称 (计数)`。点选即设 `selectedTag` 并高亮当前项。
- 触发按钮的标签反映当前选择：未选时显示「分类」，选中时显示「分类: <名称>」（或在按钮上加一个激活态/小圆点徽标，按现有视觉风格定）。
- 当 `availableTags` 为空（无任何子目录）时，可隐藏该下拉或将其禁用并提示「无子目录分类」。

## 8. 数据流总览

```
srcDir (Node 配置)
  → fantasticon 递归扫描 (**/*.svg)
  → 每个 asset: getTagsFromPath(srcDir, absolutePath)
  → IconDataItem.tags
  → WebSocket 'vite-plugin-supericon:update' payload (复用)
  → 客户端 list
  → availableTags (computed, 全量计数) + selectedTag (持久化单选)
  → sortedSearchResults 过滤管线 (search → issuesOnly → tag → sort)
  → 图标网格
```

## 9. 测试策略

- **Node**：对纯函数 `getTagsFromPath` 单测：
  - 根级文件 → `[]`
  - `srcDir/a/x.svg` → `['a']`
  - `srcDir/a/b/x.svg` → `['a', 'b']`
  - Windows 分隔符 `a\b\x.svg` 同样切分正确
- **客户端**：
  - `availableTags`：去重、计数、按名排序正确
  - 给定 `selectedTag` 时 `sortedSearchResults` 的过滤结果正确，且与搜索/issuesOnly 叠加
- 落地前先确认仓库测试设施（是否已配置 vitest）；若无则至少在 demo 中手动验证（demo 已有 `icons/debug/` 子目录可用作真实样本）。

## 10. 受影响文件清单

| 文件 | 变更 |
|------|------|
| `src/types.ts` | `IconDataItem` 新增 `tags: string[]` |
| `src/node/fontsGenerator.ts` | 新增 `getTagsFromPath`；map 中写入 `tags` |
| `src/client/logic/state/tags.ts` | 新建：`selectedTag`、`availableTags`、HMR 重置 watcher |
| `src/client/logic/state.ts` | `sortedSearchResults` 插入 tag 过滤步骤 |
| `src/client/views/Header.vue` | 新增「分类」Popover 触发按钮与面板 |
| 测试文件（位置待定） | `getTagsFromPath` 与客户端筛选的单测 |
