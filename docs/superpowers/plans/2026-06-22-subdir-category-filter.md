# 子目录类别标签筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 读取插件 `srcDir` 下的子目录结构，把每层目录名作为图标标签，在客户端 Header 工具栏新增一个单选「分类」下拉来筛选图标网格。

**Architecture:** 标签在 Node 端派生（因 `relativePath` 是项目根相对，客户端无法还原 srcDir 子目录），写入 `IconDataItem.tags: string[]`，随现有 WebSocket payload 下发。客户端把 `selectedTag`（单选、持久化）与 `availableTags`（全量计数）放在 `state.ts`，与既有的 `issuesOnly` / `issueCounts` / `sortedSearchResults` 过滤管线并列，UI 用一个 Naive UI `NPopover` 触发器复用现有 `.pop-trigger` / `.pop-card` 样式。

**Tech Stack:** TypeScript、Node `path`、`@twbs/fantasticon`、Vue 3 `<script setup>`、`@vueuse/core`（`useStorage`）、Naive UI（`NPopover`）、`@iconify/vue`。

> **与 spec 的偏差（已在 plan 中确认）：** spec 建议新建 `src/client/logic/state/tags.ts` 并在 `state.ts` 中 import `selectedTag`。本 plan 改为把 `selectedTag` / `availableTags` / tag 过滤都放在 `state.ts` 内，理由：(1) 与最接近的先例 `issuesOnly`（过滤状态）+ `issueCounts`（派生）+ 在 `sortedSearchResults` 内过滤完全对齐；(2) 避免 `state.ts ⇄ tags.ts` 循环 import；(3) diff 更小。行为与 spec 完全一致。

> **测试策略（已确认）：** 项目无测试设施，本功能**不写自动化测试**，每个 Task 通过在 demo（`./demo/src/assets/icons` 已含 `debug/` 子目录）手动验证。`pnpm dev:client` 直接以 TS 源码运行插件并指向 demo 图标，是验证回路；Node 端类型变更用 `pnpm build:node` 验证可编译。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `src/types.ts` | 共享的图标数据契约 | `IconDataItem` 新增 `tags: string[]` |
| `src/node/fontsGenerator.ts` | Node 端扫描 svg、组装 `IconDataItem` | 新增纯函数 `getTagsFromPath`；map 中写入 `tags` |
| `src/client/logic/state.ts` | 客户端图标列表、过滤/派生状态 | 新增 `selectedTag`、`availableTags`、`sortedSearchResults` 内 tag 过滤、HMR 重置 watch |
| `src/client/views/Header.vue` | 顶部工具栏 | 新增「分类」`NPopover` 触发器与面板 + 样式 |
| `src/client/views/Main.vue` | 网格渲染与跳转 | `clearSearch()` / `jumpTo()` 中同步重置 `selectedTag` |

数据流：`srcDir` → fantasticon 扫描 → `getTagsFromPath` → `IconDataItem.tags` → WS `vite-plugin-supericon:update` → 客户端 `list` → `availableTags`（全量计数）+ `selectedTag`（单选）→ `sortedSearchResults` 过滤 → 网格。

---

## Task 1: Node 端派生并下发 `tags`

**Files:**
- Modify: `src/types.ts:1-9`
- Modify: `src/node/fontsGenerator.ts:3` (import)、新增 `getTagsFromPath`、`src/node/fontsGenerator.ts:80-88`（map 返回对象）

- [ ] **Step 1: 给 `IconDataItem` 增加 `tags` 字段**

把 `src/types.ts` 第 1-9 行改为：

```ts
export interface IconDataItem {
  id: string
  useId: string
  svg: string
  svgBody: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  /** srcDir 下从外到内的每层目录名；根级图标为 [] */
  tags: string[]
}
```

- [ ] **Step 2: 在 `fontsGenerator.ts` 引入 `dirname`**

把 `src/node/fontsGenerator.ts:3`：

```ts
import { relative, join } from 'node:path'
```

改为：

```ts
import { relative, join, dirname } from 'node:path'
```

- [ ] **Step 3: 新增纯函数 `getTagsFromPath`**

在 `src/node/fontsGenerator.ts` 中、`createFontsGenerator` 函数定义之前（约第 10 行 `export function createFontsGenerator` 上方）加入：

```ts
/**
 * 取文件相对 srcDir 的目录部分，按每层目录切成标签数组。
 * 根级文件（直接位于 srcDir 下）返回 []；同时兼容 Windows 反斜杠路径。
 */
export function getTagsFromPath(srcDir: string, absolutePath: string): string[] {
  const dir = dirname(relative(srcDir, absolutePath))
  if (dir === '.' || dir === '' || dir.startsWith('..')) return []
  return dir.split(/[\\/]/).filter(Boolean)
}
```

- [ ] **Step 4: 在组装 `IconDataItem` 时写入 `tags`**

把 `src/node/fontsGenerator.ts:80-88` 的返回对象：

```ts
            return {
              id,
              useId: `${prefix}-${id}`,
              absolutePath,
              svg: svgContent,
              svgBody: svgBody,
              relativePath: relative(root, absolutePath),
              lastModified: statSync(absolutePath).mtime
            }
```

改为（新增最后一行 `tags`）：

```ts
            return {
              id,
              useId: `${prefix}-${id}`,
              absolutePath,
              svg: svgContent,
              svgBody: svgBody,
              relativePath: relative(root, absolutePath),
              lastModified: statSync(absolutePath).mtime,
              tags: getTagsFromPath(srcDir, absolutePath)
            }
```

`srcDir` 已在 `createFontsGenerator` 闭包内解构可用（`src/node/fontsGenerator.ts:16`）。

- [ ] **Step 5: 验证 Node 端可编译（含 dts 类型检查）**

Run: `pnpm build:node`
Expected: 构建成功、无 TypeScript 报错（`--dts` 会对新增的必填 `tags` 字段做类型检查；返回对象已包含 `tags`，类型匹配 `IconData`）。

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/node/fontsGenerator.ts
git commit -m "feat(node): derive subdirectory tags for each icon"
```

---

## Task 2: 客户端 `selectedTag` / `availableTags` / 过滤 / HMR 重置

**Files:**
- Modify: `src/client/logic/state.ts:2`（import）、`:42` 之后（新增状态）、`:49-64`（过滤）、文件末尾（watch）

- [ ] **Step 1: 在 `state.ts` 引入 `watch`**

把 `src/client/logic/state.ts:2`：

```ts
import { computed, ref } from 'vue'
```

改为：

```ts
import { computed, ref, watch } from 'vue'
```

- [ ] **Step 2: 新增 `selectedTag` 与 `availableTags`**

在 `src/client/logic/state.ts` 中 `issuesOnly`（第 42 行）下方加入：

```ts
// 当前选中的类别标签；null 表示「全部」。单选、持久化。
export const selectedTag = useStorage<string | null>('vite-supericon:selected-tag', null)

// 基于全量 list 统计的标签 → 出现次数，按名排序，供「分类」下拉展示。
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

- [ ] **Step 3: 在 `sortedSearchResults` 中插入 tag 过滤**

把 `src/client/logic/state.ts:49-64` 的：

```ts
export const sortedSearchResults = computed(() => {
  let results = [...searchResults.value]

  if (issuesOnly.value) {
    results = results.filter((i) => i.sameWith || i.errTips || i.renderIssue)
  }

  if (sortMode.value === 'date') {
    results.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  } else {
    results.sort((a, b) => a.id.localeCompare(b.id))
  }

  if (sortDir.value === 'desc') results.reverse()
  return results
})
```

改为（在 `issuesOnly` 过滤后、排序前插入 `selectedTag` 过滤）：

```ts
export const sortedSearchResults = computed(() => {
  let results = [...searchResults.value]

  if (issuesOnly.value) {
    results = results.filter((i) => i.sameWith || i.errTips || i.renderIssue)
  }

  if (selectedTag.value) {
    results = results.filter((i) => i.tags?.includes(selectedTag.value!))
  }

  if (sortMode.value === 'date') {
    results.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  } else {
    results.sort((a, b) => a.id.localeCompare(b.id))
  }

  if (sortDir.value === 'desc') results.reverse()
  return results
})
```

- [ ] **Step 4: 新增 HMR 重置 watch**

在 `src/client/logic/state.ts` 中 `getHot().then(...)` 块（第 80-82 行）下方加入：

```ts
// 当选中的标签因目录被删/改名而从 availableTags 中消失时，重置为「全部」，
// 避免出现无法解释的空网格。
watch(availableTags, (tags) => {
  if (selectedTag.value && !tags.some((t) => t.name === selectedTag.value)) {
    selectedTag.value = null
  }
})
```

- [ ] **Step 5: 验证过滤逻辑（用 localStorage 手动触发）**

Run: `pnpm dev:client`
打开终端打印的本地 URL。在浏览器 DevTools Console 执行：

```js
localStorage['vite-supericon:selected-tag'] = '"debug"'; location.reload()
```

Expected: 网格只剩 `debug/` 子目录下的图标（demo 中为 `gg-abstract`、`gg-add-r` 两个）。再执行 `localStorage['vite-supericon:selected-tag'] = 'null'; location.reload()` 应恢复全部图标。

- [ ] **Step 6: Commit**

```bash
git add src/client/logic/state.ts
git commit -m "feat(client): add category tag filter state and filtering"
```

---

## Task 3: Header 新增「分类」下拉

**Files:**
- Modify: `src/client/views/Header.vue`（模板新增 NPopover、`<script setup>` import、`<style>` 新增样式）

- [ ] **Step 1: 在 Header 的 import 中加入 `selectedTag` / `availableTags`**

把 `src/client/views/Header.vue:156`：

```ts
import { list, searchText, showNames, sortDir } from '../logic'
```

改为：

```ts
import { list, searchText, showNames, sortDir, selectedTag, availableTags } from '../logic'
```

- [ ] **Step 2: 在 SORT popover 之前插入「分类」popover**

在 `src/client/views/Header.vue` 模板中、`<!-- Popover toolbar -->` 的 `<div class="flex items-center gap-2">`（第 33 行）之后、`<!-- SORT -->`（第 34 行）之前插入：

```vue
      <!-- CATEGORY -->
      <NPopover
        v-if="availableTags.length"
        :theme-overrides="{ padding: '0' }"
        trigger="hover"
        placement="bottom-end"
        :show-arrow="false"
      >
        <template #trigger>
          <button class="pop-trigger">
            <Icon icon="material-symbols:category-outline-rounded" class="text-base" />
            <span>{{ selectedTag ?? '分类' }}</span>
            <Icon icon="material-symbols:keyboard-arrow-down" class="text-sm text-fg-subtle" />
          </button>
        </template>
        <div class="pop-card">
          <div class="pop-title">分类</div>
          <div class="tag-list">
            <button
              class="tag-row"
              :class="[selectedTag === null && 'is-active']"
              @click="selectedTag = null"
            >
              <span>全部</span>
              <span class="tag-count">{{ list.length }}</span>
            </button>
            <button
              v-for="tag in availableTags"
              :key="tag.name"
              class="tag-row"
              :class="[selectedTag === tag.name && 'is-active']"
              @click="selectedTag = tag.name"
            >
              <span>{{ tag.name }}</span>
              <span class="tag-count">{{ tag.count }}</span>
            </button>
          </div>
        </div>
      </NPopover>

```

- [ ] **Step 3: 在 Header 的 `<style scoped>` 末尾新增标签列表样式**

在 `src/client/views/Header.vue` 的 `<style lang="scss" scoped>` 内、`.sort-dir-row { ... }` 规则之后（第 309 行 `}` 之后、`</style>` 之前）加入：

```scss
.tag-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}

.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s var(--ease-out);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-sunken);
  }

  &.is-active {
    background: var(--bg-base);
    color: var(--text-primary);
    border-color: var(--border-default);
  }
}

.tag-count {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: 验证 Header 下拉**

Run: `pnpm dev:client`
打开本地 URL（若 Task 2 的 dev server 仍在运行，HMR 会自动刷新）。

Expected:
- 工具栏出现「分类 ▾」按钮，悬停展开面板，列出「全部 (N)」与「debug (2)」。
- 点击「debug」：网格只剩 `debug/` 下的图标，触发按钮文案变为「debug」。
- 点击「全部」：恢复全部图标，按钮文案变回「分类」。
- 由于 demo 仅有一个子目录，可临时在 `demo/src/assets/icons/` 下新建一个子目录（如 `arrows/`）放一个 svg，确认面板新增「arrows」项后再删除（验证完恢复）。

- [ ] **Step 5: Commit**

```bash
git add src/client/views/Header.vue
git commit -m "feat(client): add category dropdown to header"
```

---

## Task 4: 跳转/清除时同步重置类别筛选

**Files:**
- Modify: `src/client/views/Main.vue:199-213`（import）、`:246-251`（clearSearch）、`:255-262`（jumpTo）

- [ ] **Step 1: 在 Main 的 import 中加入 `selectedTag`**

把 `src/client/views/Main.vue:199-213` 的 import 块：

```ts
import {
  isLoading,
  getHtmlCode,
  sortedSearchResults,
  searchText,
  list,
  density,
  showNames,
  issuesOnly,
  issueCounts,
  sortMode,
  sortDir,
  page,
  _IconDataItem
} from '../logic'
```

改为（新增 `selectedTag`）：

```ts
import {
  isLoading,
  getHtmlCode,
  sortedSearchResults,
  searchText,
  list,
  density,
  showNames,
  issuesOnly,
  issueCounts,
  sortMode,
  sortDir,
  selectedTag,
  page,
  _IconDataItem
} from '../logic'
```

- [ ] **Step 2: 在 `clearSearch()` 中重置 `selectedTag`**

把 `src/client/views/Main.vue:246-251`：

```ts
function clearSearch() {
  searchText.value = ''
  issuesOnly.value = false
  sortMode.value = 'default'
  sortDir.value = 'asc'
}
```

改为：

```ts
function clearSearch() {
  searchText.value = ''
  issuesOnly.value = false
  selectedTag.value = null
  sortMode.value = 'default'
  sortDir.value = 'asc'
}
```

- [ ] **Step 3: 在 `jumpTo()` 的 not-found 分支重置 `selectedTag`**

把 `src/client/views/Main.vue:255-262`：

```ts
async function jumpTo(peer: _IconDataItem) {
  let el = document.getElementById(peer.useId)
  if (!el) {
    searchText.value = ''
    issuesOnly.value = false
    await nextTick()
    el = document.getElementById(peer.useId)
  }
```

改为（在清空 `searchText`/`issuesOnly` 处一并清空 `selectedTag`）：

```ts
async function jumpTo(peer: _IconDataItem) {
  let el = document.getElementById(peer.useId)
  if (!el) {
    searchText.value = ''
    issuesOnly.value = false
    selectedTag.value = null
    await nextTick()
    el = document.getElementById(peer.useId)
  }
```

- [ ] **Step 4: 验证一致性**

Run: `pnpm dev:client`
Expected:
- 选中某个分类后，触发空状态的「清除」入口（`clearSearch`）→ 分类恢复为「全部」。
- 选中一个**不含**某重复图标的分类，在详情中点击跳转到该重复 peer（`jumpTo`）→ 分类被清空、页面滚动并高亮到目标图标（不再因被分类过滤而跳转失败）。

- [ ] **Step 5: Commit**

```bash
git add src/client/views/Main.vue
git commit -m "feat(client): reset category filter on clear/jump to keep navigation consistent"
```

---

## Self-Review

**Spec coverage：**
- srcDir 子目录作为标签（每层独立）→ Task 1 `getTagsFromPath`。✓
- `IconDataItem.tags: string[]`、根级 `[]` → Task 1 Step 1/3。✓
- Node 端派生、复用现有 WS → Task 1（未改 `rpc.ts`/`index.ts`）。✓
- 单选 + 全量计数 → Task 2 `selectedTag`（单值）、`availableTags`（基于全量 `list`）。✓
- 在过滤管线中按 tag 过滤 → Task 2 Step 3。✓
- HMR 后选中标签消失则重置 → Task 2 Step 4。✓
- Header 工具栏下拉（复用 `.pop-trigger`/`.pop-card`、`NPopover`）→ Task 3。✓
- `availableTags` 为空时隐藏下拉 → Task 3 `v-if="availableTags.length"`。✓
- 不提供「未分类」项（根级图标只在「全部」下）→ 设计中 `availableTags` 不含空标签，根级图标 `tags: []` 不被任何具体标签过滤命中。✓
- 一致性（跳转/清除时重置）→ Task 4（超出 spec 的补强，已说明理由）。✓

**Placeholder scan：** 无 TBD/TODO；每个代码步骤均给出完整前后代码与确切行号。

**Type consistency：** `tags: string[]` 在 `src/types.ts` 定义，Node 端 `getTagsFromPath` 返回 `string[]` 写入；客户端 `availableTags` 元素为 `{ name: string; count: number }`，Header 中 `tag.name` / `tag.count` 一致引用；`selectedTag` 为 `string | null`，过滤用 `i.tags?.includes(selectedTag.value!)`、重置统一写 `selectedTag.value = null`。命名全程一致。
