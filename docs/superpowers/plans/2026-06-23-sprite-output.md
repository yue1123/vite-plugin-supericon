# P2 SVG Sprite 产出(font/svg 双格式)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 iconfont 之外并行产出 svg sprite,使 `vite-plugin-supericon` 支持 font / svg 双格式平等共存:配置结构化(`font:{}` / `svg:{}`),svg 图标经统一虚拟模块 `import 'virtual:supericon'` 注入 DOM 并以 `<use>` 消费,预览页完整适配 svg 图标。

**Architecture:** 新增独立的 `spriteGenerator`(不依赖 fantasticon)扫描 `svg.dir` 产出 `sprite.svg` 与 `format:'svg'` 图标列表;`index.ts` 编排 font / svg 两条轨道,合并列表经 WS 下发;对外仅暴露 `virtual:supericon` 一个入口(JS 模块:内部 import 嵌套 font CSS 虚拟模块 + 运行时注入 sprite,注入分 `fetch`/`inline`)。客户端预览把 sprite 注入自身 DOM 后按 `format` 分流渲染网格与详情。

**Tech Stack:** TypeScript、Node `fs`/`path`、`@twbs/fantasticon`(font 轨)、Vite 插件钩子(`config`/`configureServer`/`resolveId`/`load`)、Vue 3 `<script setup>`、Naive UI、`@iconify/vue`。

## Global Constraints

- **Node 引擎 `>=14`**(`package.json:engines`):**禁用** `readdirSync(dir, { recursive: true })`(Node 18+),sprite 目录遍历用手写递归 `readdirSync(dir, { withFileTypes: true })`。
- **不新增运行时依赖**:只用已在 `package.json` / pnpm catalog 中的包。
- **`prefix` 单一真源**(默认 `'icon'`):font CSS class 与 sprite `<symbol id>` 均为 `${prefix}-${id}`。
- **ESM only**;产物经 `tsup ... --format esm --dts` 构建。
- **无自动化测试设施**:本功能不写自动化测试,每个 Task 以 `pnpm build:node`(类型检查)+ `pnpm dev:client`(预览回路,插件指向 `demo/src/assets`)/ `pnpm demo:dev`(消费方回路,`import 'virtual:supericon'`)手动验证。
- **pre-1.0(0.0.6)**:`srcDir`/顶层 `name` 改为 `@deprecated`,提供 shim 映射到 `font` 并 `warn`,非硬破坏。
- **构建期资源 hash / asset pipeline** 不在本计划范围(`TODO-node.md` 既有项);sprite 的 dev 交付沿用现有 font 的 `@fs/` 路径。

---

## File Structure

| 文件 | 责任 | 变更 |
|------|------|------|
| `src/node/options.ts` | 配置契约 | 重构:公共项 + `font:{}` + `svg:{}` + `@deprecated srcDir/name` |
| `src/types.ts` | 共享数据契约 | `IconDataItem` 增 `format`/`viewBox`;`UpdatePayload` 增 `spritePath` |
| `src/node/constants.ts` | 常量 | 虚拟模块 id(JS 入口 + 内部 font CSS)、`DEFAULT_SPRITE_NAME`、`SVG_VIEWBOX_REG` |
| `src/node/fontsGenerator.ts` | font 轨生成 | 解耦参数类型;列表项打 `format:'font'`+`viewBox`;catch `resolve([])` |
| `src/node/spriteGenerator.ts` | svg 轨生成 | **新增**:扫 `svg.dir` → `sprite.svg` + `format:'svg'` 列表 |
| `src/node/index.ts` | 插件编排 | `resolveDir`;校验+shim;双轨;watch 双 dir;save 守卫放宽;统一虚拟模块 |
| `src/client/logic/state.ts` | 预览状态 | 注入预览 sprite;`detectRenderIssues` 跳过 svg |
| `src/client/logic/copy.ts` | 代码片段 | 新增 `getSvgUseCode` |
| `src/client/views/Main.vue` | 网格 | 按 `format` 渲染 + `SVG` 角标 + `:key` |
| `src/client/views/DetailsModal.vue` | 详情弹窗 | 输出插槽按 format 切换;banner 仅 font;svg 片段;format 元信息 |
| `src/client/vite.config.ts` | 预览自身 dev 配置 | 迁移到新 API + 加 `svg.dir` |
| `demo/vite.config.ts` | 消费方 demo 配置 | 迁移到新 API + 加 `svg.dir` |
| `demo/src/assets/svgicons/**` | demo svg 样例 | **新增**:多色 svg + 子目录(验证 tag) |
| `demo/src/App.vue` | demo 页面 | 加一处 `<use>` 示例(可视确认) |

---

## Task 1: Node 配置/类型/常量重构,font 轨走新 API

**Files:**
- Modify: `src/types.ts:1-18`
- Modify: `src/node/options.ts`(整体重写)
- Modify: `src/node/constants.ts:9`(追加)
- Modify: `src/node/fontsGenerator.ts:1-36`、`:90-108`
- Modify: `src/node/index.ts:22-148`
- Modify: `src/client/vite.config.ts:24-26`
- Modify: `demo/vite.config.ts`

**Interfaces:**
- Produces:
  - `IconDataItem.format: 'font' | 'svg'`、`IconDataItem.viewBox: string`、`UpdatePayload.spritePath?: string`
  - `Options`(含 `prefix?`、`font?: FontTrackOptions`、`svg?: SvgTrackOptions`、`@deprecated srcDir?/name?`)
  - `FontTrackOptions`、`SvgTrackOptions`
  - `createFontsGenerator(root, options: FontGeneratorRunnerOptions)`(参数类型从 `Options & Pick<RunnerOptions>` 改为显式 `FontGeneratorRunnerOptions`)
  - `constants`: `SVG_VIEWBOX_REG`
- Consumes: 既有 `getTagsFromPath`、`SVG_TAG_REG`/`XML_TAG_REG`、`DEFAULT_FONT_NAME`。

- [ ] **Step 1: 给 `IconDataItem` / `UpdatePayload` 加字段**

把 `src/types.ts` 第 1-18 行整体替换为:

```ts
export interface IconDataItem {
  id: string
  /** font: CSS class;svg: <symbol> id。两者均为 `${prefix}-${id}` */
  useId: string
  /** 交付格式,由所属源目录决定 */
  format: 'font' | 'svg'
  svg: string
  svgBody: string
  /** 真实 viewBox,如 '0 0 24 24' */
  viewBox: string
  relativePath: string
  absolutePath: string
  lastModified: Date
  /** 所属源目录下从外到内的每层目录名;根级图标为 [] */
  tags: string[]
}
export type IconData = IconDataItem[]

export type UpdatePayload = {
  name: string
  cssPath: string
  /** sprite.svg 磁盘绝对路径;无 svg 轨时为 undefined */
  spritePath?: string
  iconList: IconData
}
```

- [ ] **Step 2: 重写 `options.ts`**

把 `src/node/options.ts` 整体替换为:

```ts
export interface FontTrackOptions {
  /** font 图标源目录 */
  dir: string
  /** 字体名 @default 'iconfont' */
  name?: string
  descent?: number
  /** @default 300 */
  fontHeight?: number
  round?: number
  selector?: string
  /** @default 'i' */
  tag?: string
  cssTemplate?: string
  /** @default true */
  normalize?: boolean
}

export interface SvgTrackOptions {
  /** svg(sprite)图标源目录 */
  dir: string
  /**
   * sprite 注入方式
   * - 'fetch':运行时 fetch 外联 sprite.svg 后注入
   * - 'inline':sprite 内容内联进虚拟模块,导入时同步注入
   * @default 'fetch'
   */
  inject?: 'fetch' | 'inline'
  /** sprite 文件名(不含扩展名)@default 'sprite' */
  spriteName?: string
}

export interface Options {
  /** font CSS class 与 sprite symbol id 的共享前缀 @default 'icon' */
  prefix?: string
  /** @default true */
  clearCache?: boolean
  /** @default true */
  watch?: boolean
  /** @default 读取 Vite config */
  base?: string
  /** @default false */
  open?: boolean
  /** @default false */
  silent?: boolean
  /** font 轨 */
  font?: FontTrackOptions
  /** svg / sprite 轨 */
  svg?: SvgTrackOptions
  /** @deprecated 改用 `font.dir` */
  srcDir?: string
  /** @deprecated 改用 `font.name` */
  name?: string
}
```

- [ ] **Step 3: 在 `constants.ts` 追加 `SVG_VIEWBOX_REG`**

把 `src/node/constants.ts` 第 9 行(`export const XML_TAG_REG = /<\?xml.*>/gm`)之后追加:

```ts
export const SVG_VIEWBOX_REG = /viewBox\s*=\s*"([^"]*)"/
```

- [ ] **Step 4: `fontsGenerator.ts` 解耦参数类型 + 打 `format`/`viewBox` + catch resolve**

把 `src/node/fontsGenerator.ts:1`:

```ts
import { FontAssetType, OtherAssetType, generateFonts, RunnerOptions } from '@twbs/fantasticon'
```

改为:

```ts
import { FontAssetType, OtherAssetType, generateFonts } from '@twbs/fantasticon'
```

把 `src/node/fontsGenerator.ts:7`:

```ts
import { SVG_TAG_REG, XML_TAG_REG } from './constants'
```

改为:

```ts
import { SVG_TAG_REG, XML_TAG_REG, SVG_VIEWBOX_REG } from './constants'
```

删除 `src/node/fontsGenerator.ts:9` 的 `import { Options } from './options'`(不再使用)。

把 `src/node/fontsGenerator.ts:21-24` 的函数签名:

```ts
export function createFontsGenerator(
  root: string,
  options: Options & Pick<RunnerOptions, 'outputDir'>
) {
```

改为:

```ts
export interface FontGeneratorRunnerOptions {
  srcDir: string
  outputDir: string
  name: string
  prefix: string
  descent?: number
  fontHeight?: number
  round?: number
  normalize?: boolean
  tag?: string
  selector?: string
  cssTemplate?: string
}

export function createFontsGenerator(root: string, options: FontGeneratorRunnerOptions) {
```

把 `src/node/fontsGenerator.ts:90-99` 的返回对象:

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

改为(新增 `format`/`viewBox`):

```ts
            return {
              id,
              useId: `${prefix}-${id}`,
              format: 'font' as const,
              absolutePath,
              svg: svgContent,
              svgBody: svgBody,
              viewBox: svgContent.match(SVG_VIEWBOX_REG)?.[1]?.trim() || '0 0 24 24',
              relativePath: relative(root, absolutePath),
              lastModified: statSync(absolutePath).mtime,
              tags: getTagsFromPath(srcDir, absolutePath)
            }
```

把 `src/node/fontsGenerator.ts:106-108` 的 catch:

```ts
        .catch((err) => {
          error(err.message || err)
        })
```

改为(避免 Promise 永挂,采纳 TODO-node.md P0):

```ts
        .catch((err) => {
          error(err.message || err)
          resolve([])
        })
```

- [ ] **Step 5: 重写 `index.ts` 的解构、校验+shim、目录解析与 font 生成**

把 `src/node/index.ts:22-38`:

```ts
export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    name = DEFAULT_FONT_NAME,
    srcDir: _srcDir,
    ...fontOptions
  } = options || {}
  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  let distDir = resolve(root, './node_modules/.supericon')

  let srcDir: string
  let fontsGenerator: ReturnType<typeof createFontsGenerator>
```

改为:

```ts
export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    prefix = 'icon',
    font: _font,
    svg,
    srcDir: _legacySrcDir,
    name: _legacyName
  } = options || {}

  // 弃用 shim:顶层 srcDir/name → font 轨
  let font = _font
  if (!font && _legacySrcDir) {
    console.warn(
      c.yellow(`[${NAME}] 顶层 \`srcDir\`/\`name\` 已弃用,请改用 \`font: { dir, name }\``)
    )
    font = { dir: _legacySrcDir, name: _legacyName }
  }
  if (!font && !svg) {
    throw new Error(`[${NAME}] 需至少配置 \`font\` 或 \`svg\` 之一`)
  }

  const fontName = font?.name ?? DEFAULT_FONT_NAME

  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  const distDir = resolve(root, './node_modules/.supericon')

  let fontDir: string | undefined
  let fontsGenerator: ReturnType<typeof createFontsGenerator> | undefined
```

- [ ] **Step 6: 改 `config` 钩子 —— 抽 `resolveDir`、解析 font.dir、按新参数建 font 生成器**

把 `src/node/index.ts:122-149`(`config(config, { command }) { ... }` 整段)替换为:

```ts
    config(viteConfig, { command }) {
      isDev = command === 'serve'

      const resolveDir = (dir: string): string => {
        const alias = viteConfig.resolve?.alias
        if (alias && !Array.isArray(alias)) {
          for (const key of Object.keys(alias)) {
            if (dir.includes(key)) {
              // @ts-ignore alias 值类型可能为 string
              return dir.replace(key, alias[key])
            }
          }
        }
        return resolve(root, dir)
      }

      if (clearCache) {
        emptyDirSync(distDir)
      }

      if (font) {
        fontDir = resolveDir(font.dir)
        fontsGenerator = createFontsGenerator(root, {
          srcDir: fontDir,
          outputDir: distDir,
          name: fontName,
          prefix,
          descent: font.descent,
          fontHeight: font.fontHeight,
          round: font.round,
          normalize: font.normalize,
          tag: font.tag,
          selector: font.selector,
          cssTemplate: font.cssTemplate
        })
      }
    },
```

- [ ] **Step 7: 把 `configureServer` 里对旧 `srcDir`/`name` 的引用换成 `fontDir`/`fontName`(font 单轨过渡)**

把 `src/node/index.ts:46-60`:

```ts
    const regenerateFont = debounce((force: boolean = true) => {
      fontsGenerator.run(force).then((data) => {
        rpcServer.send('update', {
          name,
          iconList: data,
          cssPath: `${distDir}/${name}.css`
        })
      })
    }, 500)

    if (watch) {
      server.watcher.add(srcDir)
      server.watcher.on('add', () => regenerateFont(true))
      server.watcher.on('unlink', () => regenerateFont(true))
      server.watcher.on('change', () => regenerateFont(true))
    }
```

改为:

```ts
    const regenerateFont = debounce((force: boolean = true) => {
      ;(fontsGenerator?.run(force) ?? Promise.resolve([])).then((data) => {
        rpcServer.send('update', {
          name: fontName,
          iconList: data,
          cssPath: `${distDir}/${fontName}.css`
        })
      })
    }, 500)

    if (watch && fontDir) {
      server.watcher.add(fontDir)
      server.watcher.on('add', () => regenerateFont(true))
      server.watcher.on('unlink', () => regenerateFont(true))
      server.watcher.on('change', () => regenerateFont(true))
    }
```

把 `src/node/index.ts:65-76`(save RPC 守卫)中的 `srcDir`:

```ts
        const target = resolve(data.absolutePath)
        if (!target.startsWith(srcDir)) {
          console.warn(c.yellow(`[${NAME}] refused to write outside srcDir: ${target}`))
          return
        }
```

改为(暂以 fontDir 守卫,Task 2 放宽到双 dir):

```ts
        const target = resolve(data.absolutePath)
        if (!fontDir || !target.startsWith(fontDir)) {
          console.warn(c.yellow(`[${NAME}] refused to write outside srcDir: ${target}`))
          return
        }
```

把 `src/node/index.ts:164-167`(`load` 内)的 `name`:

```ts
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        await fontsGenerator.run()
        return `@import './node_modules/.supericon/${name}.css'`
      }
```

改为:

```ts
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }
```

- [ ] **Step 8: 迁移 `src/client/vite.config.ts` 到新 API(font 单轨)**

把 `src/client/vite.config.ts:24-26`:

```ts
      superIcon({
        srcDir: './demo/src/assets/icons'
      })
```

改为:

```ts
      superIcon({
        font: { dir: './demo/src/assets/icons' }
      })
```

- [ ] **Step 9: 迁移 `demo/vite.config.ts` 到新 API(font 单轨)**

把 `demo/vite.config.ts` 的 `superIcon({ name, srcDir })` 块:

```ts
      superIcon({
        name: 'my-icons',
        srcDir: './src/assets/icons'
      })
```

改为:

```ts
      superIcon({
        font: { dir: './src/assets/icons', name: 'my-icons' }
      })
```

- [ ] **Step 10: 类型检查**

Run: `pnpm build:node`
Expected: 构建成功、无 TS 报错(`--dts` 会校验 `IconDataItem` 新增必填 `format`/`viewBox` 已在 `fontsGenerator` 返回对象中提供)。

- [ ] **Step 11: 回归验证(font 轨仍正常)**

Run: `pnpm dev:client`
打开终端打印的 SuperIcon URL。
Expected:
- 网格正常展示 font 图标(与改动前一致),无报错。
- DevTools Console 无 `需至少配置` 抛错。
- 终端出现一次 deprecation `warn`?——本步用的是新 API,不应出现;若临时把 `src/client/vite.config.ts` 改回 `srcDir:'...'` 重启,应打印一次 `srcDir/name 已弃用` 后仍正常工作(验证 shim,验后改回新 API)。

- [ ] **Step 12: Commit**

```bash
git add src/types.ts src/node/options.ts src/node/constants.ts src/node/fontsGenerator.ts src/node/index.ts src/client/vite.config.ts demo/vite.config.ts
git commit -m "refactor(node): restructure config into font/svg tracks; add format/viewBox

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `spriteGenerator` + 双轨编排 + 合并下发

**Files:**
- Create: `src/node/spriteGenerator.ts`
- Modify: `src/node/constants.ts`(追加 `DEFAULT_SPRITE_NAME`)
- Modify: `src/node/index.ts`(import、svg 生成器、双轨 regenerate、watch、save 守卫)
- Modify: `src/client/vite.config.ts`(加 `svg.dir`)
- Create: `demo/src/assets/svgicons/multi-heart.svg`、`demo/src/assets/svgicons/brand/logo-demo.svg`

**Interfaces:**
- Consumes(Task 1):`IconData`、`SVG_TAG_REG`/`XML_TAG_REG`/`SVG_VIEWBOX_REG`、`getTagsFromPath`、`error`。
- Produces:
  - `createSpriteGenerator(root: string, options: { svgDir: string; outputDir: string; prefix: string; spriteName: string }): { run(force?: boolean): Promise<IconData> }`
  - `constants.DEFAULT_SPRITE_NAME = 'sprite'`
  - WS `update` payload 现含合并后的 `iconList`(font+svg)与 `spritePath`。

- [ ] **Step 1: 追加 `DEFAULT_SPRITE_NAME` 常量**

把 `src/node/constants.ts` 的 `export const DEFAULT_FONT_NAME = 'iconfont'` 之后追加:

```ts
export const DEFAULT_SPRITE_NAME = 'sprite'
```

- [ ] **Step 2: 新建 `spriteGenerator.ts`**

新建 `src/node/spriteGenerator.ts`,内容:

```ts
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { ensureDirSync } from 'fs-extra'

import { IconData } from '../types'
import { SVG_TAG_REG, XML_TAG_REG, SVG_VIEWBOX_REG } from './constants'
import { error } from './utils'
import { getTagsFromPath } from './fontsGenerator'

export interface SpriteGeneratorOptions {
  svgDir: string
  outputDir: string
  prefix: string
  spriteName: string
}

/** 手写递归(兼容 Node >=14,不用 readdirSync 的 recursive 选项)。 */
function walkSvgFiles(dir: string): string[] {
  const out: string[] = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkSvgFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.svg')) out.push(full)
  }
  return out
}

export function createSpriteGenerator(root: string, options: SpriteGeneratorOptions) {
  const { svgDir, outputDir, prefix, spriteName } = options
  let promise: Promise<IconData> | undefined

  const run = (force?: boolean): Promise<IconData> => {
    if (promise && !force) return promise
    ensureDirSync(svgDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve) => {
      try {
        const files = walkSvgFiles(svgDir)
        const symbols: string[] = []
        const data: IconData = files.map((absolutePath) => {
          const svgContent = readFileSync(absolutePath).toString()
          const id = basename(absolutePath, '.svg')
          const useId = `${prefix}-${id}`
          const viewBox = svgContent.match(SVG_VIEWBOX_REG)?.[1]?.trim() || '0 0 24 24'
          const svgBody = svgContent
            .replace(SVG_TAG_REG, '')
            .replace(XML_TAG_REG, '')
            .replace(/\n/g, '')
            .trim()
          symbols.push(`<symbol id="${useId}" viewBox="${viewBox}">${svgBody}</symbol>`)
          return {
            id,
            useId,
            format: 'svg' as const,
            absolutePath,
            svg: svgContent,
            svgBody,
            viewBox,
            relativePath: relative(root, absolutePath),
            lastModified: statSync(absolutePath).mtime,
            tags: getTagsFromPath(svgDir, absolutePath)
          }
        })

        const sprite =
          `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
          `style="position:absolute;width:0;height:0;overflow:hidden">` +
          symbols.join('') +
          `</svg>`
        writeFileSync(join(outputDir, `${spriteName}.svg`), sprite)
        resolve(data)
      } catch (err: any) {
        error(err?.message || err)
        resolve([])
      }
    })
    return promise
  }

  return { run }
}
```

- [ ] **Step 3: `index.ts` 引入 sprite 生成器与默认名**

把 `src/node/index.ts:17-18`:

```ts
import { createFontsGenerator } from './fontsGenerator'
import { createRpcServer } from './rpc'
```

改为:

```ts
import { createFontsGenerator } from './fontsGenerator'
import { createSpriteGenerator } from './spriteGenerator'
import { createRpcServer } from './rpc'
```

把 `src/node/index.ts` 的 `constants` import 块(第 3-10 行)中追加 `DEFAULT_SPRITE_NAME`:

```ts
import {
  NAME,
  isCI,
  CLIENT_URL,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  DEFAULT_FONT_NAME,
  DEFAULT_SPRITE_NAME
} from './constants'
```

- [ ] **Step 4: 声明 svg 轨变量并在 `config` 钩子建 sprite 生成器**

把 Task 1 Step 5 写入的 `let fontDir: string | undefined` / `let fontsGenerator ...` 两行(现 `src/node/index.ts` 顶部闭包变量)之后追加:

```ts
  const spriteName = svg?.spriteName ?? DEFAULT_SPRITE_NAME
  const injectMode = svg?.inject ?? 'fetch'
  let svgDir: string | undefined
  let spriteGenerator: ReturnType<typeof createSpriteGenerator> | undefined
```

在 `config` 钩子里(Task 1 Step 6 写入的 `if (font) { ... }` 块之后、`},` 之前)追加:

```ts
      if (svg) {
        svgDir = resolveDir(svg.dir)
        spriteGenerator = createSpriteGenerator(root, {
          svgDir,
          outputDir: distDir,
          prefix,
          spriteName
        })
      }
```

- [ ] **Step 5: `regenerate` 跑双轨并合并下发**

把 Task 1 Step 7 写入的 `regenerateFont` debounce 块整体替换为:

```ts
    const regenerate = debounce((force: boolean = true) => {
      Promise.all([
        fontsGenerator?.run(force) ?? Promise.resolve([] as IconData),
        spriteGenerator?.run(force) ?? Promise.resolve([] as IconData)
      ]).then(([fontList, svgList]) => {
        rpcServer.send('update', {
          name: fontName,
          iconList: [...fontList, ...svgList],
          cssPath: `${distDir}/${fontName}.css`,
          spritePath: svgDir ? `${distDir}/${spriteName}.svg` : undefined
        })
      })
    }, 500)
```

> 注:本步把函数名从 `regenerateFont` 改为 `regenerate`。下方 watch 与 `server.ws.on('connection')` 的调用需同步改名(见 Step 6、Step 7)。`IconData` 已由 `import { UpdatePayload } from '../types'` 同文件可用?——需确认 import:把 `src/node/index.ts:19` 的 `import { UpdatePayload } from '../types'` 改为 `import { UpdatePayload, IconData } from '../types'`。

- [ ] **Step 6: watch 双 dir + 调用改名**

把 Task 1 Step 7 写入的 watch 块:

```ts
    if (watch && fontDir) {
      server.watcher.add(fontDir)
      server.watcher.on('add', () => regenerateFont(true))
      server.watcher.on('unlink', () => regenerateFont(true))
      server.watcher.on('change', () => regenerateFont(true))
    }
```

改为:

```ts
    if (watch) {
      for (const d of [fontDir, svgDir]) if (d) server.watcher.add(d)
      const onChange = () => regenerate(true)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('change', onChange)
    }
```

把 `src/node/index.ts` 的 `server.ws.on('connection', () => { regenerateFont(false) })`:

```ts
    server.ws.on('connection', () => {
      regenerateFont(false)
    })
```

改为:

```ts
    server.ws.on('connection', () => {
      regenerate(false)
    })
```

- [ ] **Step 7: save 守卫放宽到双 dir**

把 Task 1 Step 7 写入的 save 守卫:

```ts
        const target = resolve(data.absolutePath)
        if (!fontDir || !target.startsWith(fontDir)) {
          console.warn(c.yellow(`[${NAME}] refused to write outside srcDir: ${target}`))
          return
        }
```

改为:

```ts
        const target = resolve(data.absolutePath)
        const allowed = [fontDir, svgDir].filter(Boolean) as string[]
        if (!allowed.some((d) => target.startsWith(d))) {
          console.warn(c.yellow(`[${NAME}] refused to write outside src dirs: ${target}`))
          return
        }
```

- [ ] **Step 8: 预览自身配置加 svg 轨**

把 `src/client/vite.config.ts` 的:

```ts
      superIcon({
        font: { dir: './demo/src/assets/icons' }
      })
```

改为:

```ts
      superIcon({
        font: { dir: './demo/src/assets/icons' },
        svg: { dir: './demo/src/assets/svgicons' }
      })
```

- [ ] **Step 9: 新建 demo svg 样例(多色 + 子目录)**

新建 `demo/src/assets/svgicons/multi-heart.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#e5484d" d="M12 21s-7.5-4.6-10-9.2C.6 9 1.7 5.5 5 5c2-.3 3.4.8 4.2 2.1L12 11l2.8-3.9C15.6 5.8 17 4.7 19 5c3.3.5 4.4 4 3 6.8C19.5 16.4 12 21 12 21z"/>
  <circle fill="#ffffff" cx="9" cy="9" r="1.2"/>
</svg>
```

新建 `demo/src/assets/svgicons/brand/logo-demo.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect fill="#41d1ff" x="3" y="3" width="18" height="18" rx="4"/>
  <path fill="#ffffff" d="M13 5 7 13h4l-1 6 6-8h-4z"/>
</svg>
```

- [ ] **Step 10: 类型检查**

Run: `pnpm build:node`
Expected: 构建成功、无 TS 报错。

- [ ] **Step 11: 验证 sprite 产出与下发**

Run: `pnpm dev:client`(若上次仍在跑,先停掉重启以加载新配置)
打开 SuperIcon URL 并保持页面打开(触发 WS connection → regenerate)。
然后在另一终端:

```bash
ls node_modules/.supericon/ && echo '--- symbols ---' && grep -o 'id="icon-[^"]*"' node_modules/.supericon/sprite.svg | sort -u
```

Expected:
- 目录含 `sprite.svg`(及既有 `iconfont.*` / `iconify.json`)。
- `grep` 列出 `id="icon-multi-heart"` 与 `id="icon-logo-demo"`。
- 预览网格图标总数 = 原 font 图标数 + 2(svg 图标此刻可能显示为空白方块——渲染在 Task 4 接入,本步只验数据/产物)。

- [ ] **Step 12: Commit**

```bash
git add src/node/spriteGenerator.ts src/node/constants.ts src/node/index.ts src/client/vite.config.ts demo/src/assets/svgicons
git commit -m "feat(node): add sprite generator and orchestrate font/svg dual tracks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 统一虚拟模块 `virtual:supericon`(font CSS + sprite 注入)

**Files:**
- Modify: `src/node/constants.ts`(虚拟模块 id 改 JS 入口 + 内部 font CSS id)
- Modify: `src/node/index.ts`(`resolveId`/`load` 重写;import `readFileSync`/新常量)
- Modify: `demo/vite.config.ts`(加 `svg.dir`)
- Modify: `demo/src/App.vue`(加 `<use>` 示例)

**Interfaces:**
- Consumes:`fontsGenerator`/`spriteGenerator`(可能为 `undefined`)、`distDir`、`fontName`、`spriteName`、`injectMode`(Task 2 已声明)。
- Produces:`import 'virtual:supericon'` 单入口 = font CSS(嵌套)+ sprite 注入;内部嵌套模块 `virtual:supericon/font.css`。

- [ ] **Step 1: 调整虚拟模块常量**

把 `src/node/constants.ts:4-5`:

```ts
export const VIRTUAL_MODULE_ID = 'virtual:supericon'
export const RESOLVED_VIRTUAL_MODULE_ID = '\0' + 'virtual-supericon.css'
```

改为:

```ts
export const VIRTUAL_MODULE_ID = 'virtual:supericon'
// 公共入口改为 JS 模块(去掉 .css 后缀,Vite 即按 JS 处理)
export const RESOLVED_VIRTUAL_MODULE_ID = '\0virtual-supericon'
// 内部嵌套 font CSS 虚拟模块(承接原 CSS 逻辑,保留 Vite CSS 管线)
export const VIRTUAL_FONT_CSS_ID = 'virtual:supericon/font.css'
export const RESOLVED_VIRTUAL_FONT_CSS_ID = '\0virtual-supericon-font.css'
```

- [ ] **Step 2: index.ts 引入 `readFileSync` 与新常量**

把 `src/node/index.ts:16` 的 `import { writeFileSync } from 'node:fs'`:

```ts
import { writeFileSync } from 'node:fs'
```

改为:

```ts
import { writeFileSync, readFileSync } from 'node:fs'
```

把 constants import 块追加两个新 id:

```ts
import {
  NAME,
  isCI,
  CLIENT_URL,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_FONT_CSS_ID,
  RESOLVED_VIRTUAL_FONT_CSS_ID,
  DEFAULT_FONT_NAME,
  DEFAULT_SPRITE_NAME
} from './constants'
```

- [ ] **Step 3: 重写 `resolveId` / `load`**

把 `src/node/index.ts` 的:

```ts
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }
    }
```

改为:

```ts
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
      if (id === VIRTUAL_FONT_CSS_ID) return RESOLVED_VIRTUAL_FONT_CSS_ID
    },
    async load(id) {
      // 内部嵌套:font CSS(保持原 @import 逻辑,走 Vite CSS 管线)
      if (id === RESOLVED_VIRTUAL_FONT_CSS_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }
      // 统一入口:JS 模块 = 引入 font CSS + 注入 sprite
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const lines: string[] = []
        if (fontsGenerator) {
          await fontsGenerator.run()
          lines.push(`import ${JSON.stringify(VIRTUAL_FONT_CSS_ID)}`)
        }
        if (spriteGenerator) {
          await spriteGenerator.run()
          const spriteFile = `${distDir}/${spriteName}.svg`
          if (injectMode === 'inline') {
            const content = readFileSync(spriteFile, 'utf8')
            lines.push(`${SPRITE_INJECT_HELPER}\n__supericonInject(${JSON.stringify(content)})`)
          } else {
            const spriteUrl = `/@fs/${spriteFile}`
            lines.push(
              `${SPRITE_INJECT_HELPER}\n` +
                `fetch(${JSON.stringify(spriteUrl)}).then(function(r){return r.text()}).then(__supericonInject)`
            )
          }
        }
        return lines.join('\n')
      }
    }
```

- [ ] **Step 4: 在 `index.ts` 顶部(`superIcon` 函数外)定义注入帮助函数源码常量**

把 `src/node/index.ts` 的 `export function superIcon(options: Options): Plugin {` 这一行**之前**插入:

```ts
// 注入到用户页面的幂等帮助函数(以源码字符串形式打进虚拟模块)。
const SPRITE_INJECT_HELPER = `function __supericonInject(txt){
  if (typeof document === 'undefined') return;
  if (document.getElementById('__supericon_sprite')) return;
  var tpl = document.createElement('template');
  tpl.innerHTML = String(txt).trim();
  var svg = tpl.content.firstElementChild;
  if (!svg) return;
  svg.id = '__supericon_sprite';
  svg.setAttribute('aria-hidden','true');
  svg.style.position='absolute'; svg.style.width='0'; svg.style.height='0'; svg.style.overflow='hidden';
  document.body.prepend(svg);
}`
```

- [ ] **Step 5: demo 配置加 svg 轨**

把 `demo/vite.config.ts` 的:

```ts
      superIcon({
        font: { dir: './src/assets/icons', name: 'my-icons' }
      })
```

改为:

```ts
      superIcon({
        font: { dir: './src/assets/icons', name: 'my-icons' },
        svg: { dir: './src/assets/svgicons' }
      })
```

> demo 的 `svg.dir` 指向 `demo/src/assets/svgicons`(Task 2 Step 9 已创建样例),与预览配置共用同一物理目录。

- [ ] **Step 6: demo 页面加 `<use>` 示例**

在 `demo/src/App.vue` 的 `<template>` 中任意可见位置加入(用于肉眼确认 sprite 注入与多色渲染):

```vue
  <div style="display:flex; gap:16px; align-items:center; padding:16px">
    <span>sprite:</span>
    <svg width="48" height="48"><use href="#icon-multi-heart" /></svg>
    <svg width="48" height="48"><use href="#icon-logo-demo" /></svg>
    <span>font:</span>
    <i class="my-icons" style="font-size:48px"></i>
  </div>
```

> 注:`<i class="my-icons">` 仅占位演示字体已加载;实际 font 图标 class 形如 `icon-<id>`(取决于 demo 的 font 图标 id)。本示例核心是两个 `<use>` 能渲染出多色心形与品牌方块。

- [ ] **Step 7: 类型检查**

Run: `pnpm build:node`
Expected: 构建成功、无 TS 报错。

- [ ] **Step 8: 验证 demo 单入口(fetch 模式)**

Run: `pnpm demo:dev`
打开 demo 本地 URL。
Expected:
- 页面顶部出现红/白多色心形与蓝/白品牌方块(两个 `<use>` 渲染成功)→ 证明 `import 'virtual:supericon'` 已注入 sprite。
- font 图标样式仍生效(证明嵌套 font CSS 被一并引入)。
- DevTools Elements 中 `document.body` 首个子节点为 `<svg id="__supericon_sprite" aria-hidden="true" style="position:absolute;...">`,内含 `<symbol id="icon-multi-heart">` 等。
- Network 面板有一条对 `/@fs/.../sprite.svg` 的请求(fetch 模式)。

- [ ] **Step 9: 验证 inline 模式**

把 `demo/vite.config.ts` 的 `svg` 改为 `svg: { dir: './src/assets/svgicons', inject: 'inline' }`,重启 `pnpm demo:dev`。
Expected:
- 两个 `<use>` 仍正常渲染;`#__supericon_sprite` 仍存在。
- Network 面板**无**对 `sprite.svg` 的请求(sprite 已内联进 JS 模块)。
验证后把 `inject` 改回默认(删除该字段,回到 fetch)。

- [ ] **Step 10: Commit**

```bash
git add src/node/constants.ts src/node/index.ts demo/vite.config.ts demo/src/App.vue
git commit -m "feat(node): unify virtual:supericon entry to deliver font css + sprite injection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 预览页渲染 svg 图标(注入 + 网格按 format)

**Files:**
- Modify: `src/client/logic/state.ts`(import、`update` 注入 sprite、`detectRenderIssues` 跳过 svg)
- Modify: `src/client/views/Main.vue`(网格 `:key`/渲染/角标)

**Interfaces:**
- Consumes:`UpdatePayload.spritePath`(Task 1)、`IconDataItem.format`/`viewBox`(Task 1)、`baseUrl`(已 import 于 state.ts)。
- Produces:预览 DOM 中 `#__supericon_preview_sprite`;网格按 `format` 渲染。

- [ ] **Step 1: state.ts 在 `update` 注入预览 sprite**

把 `src/client/logic/state.ts:116-118`:

```ts
function update(data: UpdatePayload) {
  list.value = data.iconList

  const styleLink = document.getElementById('supericon') as HTMLLinkElement
```

改为:

```ts
function update(data: UpdatePayload) {
  list.value = data.iconList

  if (data.spritePath) injectPreviewSprite(data.spritePath)

  const styleLink = document.getElementById('supericon') as HTMLLinkElement
```

- [ ] **Step 2: state.ts 新增 `injectPreviewSprite`**

在 `src/client/logic/state.ts` 的 `function update(...) { ... }` 结束的 `}` 之后追加:

```ts
// 取插件产出的 sprite.svg(经 Vite @fs 服务),内联注入预览 DOM,
// 使 svg 图标的 <use href="#useId"> 在预览中可解析;每次 update 替换式重注。
async function injectPreviewSprite(spritePath: string) {
  try {
    const url = `${baseUrl || ''}@fs/${spritePath}?v=${Date.now()}`
    const res = await fetch(url)
    const txt = (await res.text()).trim()
    const tpl = document.createElement('template')
    tpl.innerHTML = txt
    const svg = tpl.content.firstElementChild as SVGElement | null
    if (!svg) return
    svg.id = '__supericon_preview_sprite'
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.style.width = '0'
    svg.style.height = '0'
    svg.style.overflow = 'hidden'
    const old = document.getElementById('__supericon_preview_sprite')
    if (old) old.replaceWith(svg)
    else document.body.prepend(svg)
  } catch {
    // sprite 不可用时静默,svg 图标显示空白,不阻断 font
  }
}
```

- [ ] **Step 3: `detectRenderIssues` 跳过 svg 图标**

把 `src/client/logic/state.ts:152-156`:

```ts
    if (token !== scanToken) return // a newer update superseded this scan
    const item = items[i]
    try {
      const info = await analyzeIcon(item.svg || item.svgBody)
```

改为:

```ts
    if (token !== scanToken) return // a newer update superseded this scan
    const item = items[i]
    if (item.format === 'svg') {
      // svg 图标不入字体,无 winding/stroke 渲染问题
      item.renderIssue = undefined
      continue
    }
    try {
      const info = await analyzeIcon(item.svg || item.svgBody)
```

- [ ] **Step 4: Main.vue 网格 `:key` 含 format**

把 `src/client/views/Main.vue:119-121`:

```vue
          v-for="item in sortedSearchResults"
          :key="item.id"
          :id="item.useId"
```

改为:

```vue
          v-for="item in sortedSearchResults"
          :key="item.format + '/' + item.id"
          :id="item.useId"
```

- [ ] **Step 5: Main.vue 按 format 渲染图标**

把 `src/client/views/Main.vue:158-161`:

```vue
          <!-- Id -->
          <div class="icon-card__glyph" :style="{ fontSize: iconSize + 'px' }">
            <i :class="item.useId"></i>
          </div>
```

改为:

```vue
          <!-- Id -->
          <div class="icon-card__glyph" :style="{ fontSize: iconSize + 'px' }">
            <i v-if="item.format !== 'svg'" :class="item.useId"></i>
            <svg
              v-else
              :width="iconSize"
              :height="iconSize"
              :viewBox="item.viewBox"
              aria-hidden="true"
            >
              <use :href="`#${item.useId}`" />
            </svg>
          </div>
```

- [ ] **Step 6: Main.vue 加 `SVG` 格式角标**

把 `src/client/views/Main.vue:129`(`<!-- Flag badge -->`)这一行**之前**插入:

```vue
          <!-- Format badge (svg only) -->
          <span v-if="item.format === 'svg'" class="badge-format">SVG</span>

```

在 `src/client/views/Main.vue` 的 `<style lang="scss" scoped>` 内、`.badge-flag { ... }` 规则之后追加:

```scss
.badge-format {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-active);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  cursor: default;
}
```

- [ ] **Step 7: 验证预览渲染**

Run: `pnpm dev:client`(重启以确保最新客户端代码)
Expected:
- 网格中出现 `multi-heart`(红/白多色心形)与 `logo-demo`(蓝/白方块),均带左上角 `SVG` 角标。
- 这两个 svg 图标**不**出现「渲染」红标(`detectRenderIssues` 已跳过)。
- 顶部「分类」下拉含 `brand (1)`(来自 `svgicons/brand/`),点选只剩 `logo-demo`。
- DevTools 中 `document.body` 含 `<svg id="__supericon_preview_sprite">`。

- [ ] **Step 8: Commit**

```bash
git add src/client/logic/state.ts src/client/views/Main.vue
git commit -m "feat(client): render svg icons in preview grid via injected sprite

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 详情弹窗适配 svg 图标

**Files:**
- Modify: `src/client/logic/copy.ts`(新增 `getSvgUseCode`)
- Modify: `src/client/views/DetailsModal.vue`(输出插槽、banner、状态徽标、检测 watch、代码片段、codeTabs、format 元信息)

**Interfaces:**
- Consumes:`IconDataItem.format`/`viewBox`/`useId`(Task 1)、`getSvgUseCode`。
- Produces:详情弹窗对 `format:'svg'` 的完整适配。

- [ ] **Step 1: copy.ts 新增 `getSvgUseCode`**

在 `src/client/logic/copy.ts` 末尾追加:

```ts
export function getSvgUseCode(useId: string) {
  return `<svg aria-hidden="true"><use href="#${useId}" /></svg>`
}
```

- [ ] **Step 2: DetailsModal 引入 `getSvgUseCode`**

把 `src/client/views/DetailsModal.vue:333-335`:

```ts
  getHtmlCode,
  getJsxCode,
  getCssCode,
```

改为:

```ts
  getHtmlCode,
  getJsxCode,
  getCssCode,
  getSvgUseCode,
```

- [ ] **Step 3: 修复 banner 仅 font 显示**

把 `src/client/views/DetailsModal.vue:29-33`:

```vue
      <div
        v-if="repairInfo?.needsRepair"
        class="repair-banner"
        :class="{ 'repair-banner--blocked': !repairInfo.supported }"
      >
```

改为:

```vue
      <div
        v-if="props.iconData.format !== 'svg' && repairInfo?.needsRepair"
        class="repair-banner"
        :class="{ 'repair-banner--blocked': !repairInfo.supported }"
      >
```

- [ ] **Step 4: 对比 stage 输出插槽按 format 切换**

把 `src/client/views/DetailsModal.vue:74-84`:

```vue
        <div class="stage__pane stage__pane--font" :style="paneStyle('font')">
          <span class="stage__pane-render-box" :class="{ hidden: !showRenderBoxAlignLine }">
            <i
              ref="fontGlyphRef"
              class="stage__media stage__media--font"
              :class="props.iconData.useId"
              :style="{ fontSize: detailSize + 'px', ...(transformStyle as any) }"
            />
          </span>
          <span class="stage__tag">Font · {{ fontRenderSize?.join(' × ') ?? '—' }}</span>
        </div>
```

改为:

```vue
        <div class="stage__pane stage__pane--font" :style="paneStyle('font')">
          <span class="stage__pane-render-box" :class="{ hidden: !showRenderBoxAlignLine }">
            <i
              v-if="props.iconData.format !== 'svg'"
              ref="fontGlyphRef"
              class="stage__media stage__media--font"
              :class="props.iconData.useId"
              :style="{ fontSize: detailSize + 'px', ...(transformStyle as any) }"
            />
            <svg
              v-else
              ref="fontGlyphRef"
              class="stage__media stage__media--font"
              :width="detailSize"
              :height="detailSize"
              :viewBox="props.iconData.viewBox"
              :style="(transformStyle as any)"
              aria-hidden="true"
            >
              <use :href="`#${props.iconData.useId}`" />
            </svg>
          </span>
          <span class="stage__tag">
            {{ props.iconData.format === 'svg' ? 'Sprite' : 'Font' }} ·
            {{ fontRenderSize?.join(' × ') ?? '—' }}
          </span>
        </div>
```

- [ ] **Step 5: 检测 watch 跳过 svg**

把 `src/client/views/DetailsModal.vue:404-414`:

```ts
watch(
  () => props.iconData?.svg,
  async (svg) => {
    repairInfo.value = null
    if (!svg) return
    const result = await detectIconIssue(svg)
    // guard against races when switching icons quickly
    if (props.iconData?.svg === svg) repairInfo.value = result
  },
  { immediate: true }
)
```

改为:

```ts
watch(
  () => props.iconData?.svg,
  async (svg) => {
    repairInfo.value = null
    if (!svg || props.iconData?.format === 'svg') return
    const result = await detectIconIssue(svg)
    // guard against races when switching icons quickly
    if (props.iconData?.svg === svg) repairInfo.value = result
  },
  { immediate: true }
)
```

- [ ] **Step 6: 状态徽标对 svg 短路**

把 `src/client/views/DetailsModal.vue:445-451`:

```ts
const statusBadge = computed<{ text: string; kind: 'ok' | 'warn' | 'checking' }>(() => {
  const info = repairInfo.value
  if (!info) return { text: '检测中…', kind: 'checking' }
  if (!info.needsRepair) return { text: '像素一致', kind: 'ok' }
  if (info.reason === 'stroke') return { text: '描边需轮廓化', kind: 'warn' }
  return { text: '渲染异常', kind: 'warn' }
})
```

改为:

```ts
const statusBadge = computed<{ text: string; kind: 'ok' | 'warn' | 'checking' }>(() => {
  if (props.iconData?.format === 'svg') return { text: 'SVG · 多色', kind: 'ok' }
  const info = repairInfo.value
  if (!info) return { text: '检测中…', kind: 'checking' }
  if (!info.needsRepair) return { text: '像素一致', kind: 'ok' }
  if (info.reason === 'stroke') return { text: '描边需轮廓化', kind: 'warn' }
  return { text: '渲染异常', kind: 'warn' }
})
```

- [ ] **Step 7: codeTabs 按 format 过滤 + 切图标重置 tab**

把 `src/client/views/DetailsModal.vue:391-397`:

```ts
const codeTabs = [
  { value: 'html' as const, label: 'HTML' },
  { value: 'react' as const, label: 'React' },
  { value: 'css' as const, label: 'React' },
  { value: 'svg' as const, label: 'SVG' }
]
const codeTab = ref<CodeLang>('html')
```

改为:

```ts
const codeTabs = computed(() =>
  props.iconData?.format === 'svg'
    ? [
        { value: 'html' as const, label: 'HTML' },
        { value: 'svg' as const, label: 'SVG' }
      ]
    : [
        { value: 'html' as const, label: 'HTML' },
        { value: 'react' as const, label: 'React' },
        { value: 'css' as const, label: 'CSS' },
        { value: 'svg' as const, label: 'SVG' }
      ]
)
const codeTab = ref<CodeLang>('html')
// 切换图标时重置到 HTML,避免 svg 图标停留在已隐藏的 React/CSS tab
watch(
  () => props.iconData?.id,
  () => {
    codeTab.value = 'html'
  }
)
```

- [ ] **Step 8: HTML 代码片段按 format 输出**

把 `src/client/views/DetailsModal.vue:262-277`(`<template v-if="codeTab === 'html'">` 整段):

```vue
          <template v-if="codeTab === 'html'">
            <h3 class="section-title mt-2!">html</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto">
                <NCode
                  class="lang-markup"
                  language="xml"
                  :code="getHtmlCode(props.iconData.id)"
                ></NCode>
                <ClipboardButton
                  :text="getHtmlCode(props.iconData.id)"
                  class="absolute right-2 top-4.5"
                />
              </div>
            </div>
          </template>
```

改为:

```vue
          <template v-if="codeTab === 'html'">
            <h3 class="section-title mt-2!">html</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto">
                <NCode class="lang-markup" language="xml" :code="htmlSnippet"></NCode>
                <ClipboardButton :text="htmlSnippet" class="absolute right-2 top-4.5" />
              </div>
            </div>
          </template>
```

在 `src/client/views/DetailsModal.vue` 的 `<script setup>` 中、`const svgCode = computed(...)`(第 452 行)之后追加:

```ts
const htmlSnippet = computed(() => {
  if (!props.iconData) return ''
  return props.iconData.format === 'svg'
    ? getSvgUseCode(props.iconData.useId)
    : getHtmlCode(props.iconData.id)
})
```

- [ ] **Step 9: 元信息加「格式」行**

把 `src/client/views/DetailsModal.vue:222-228`(viewBox 行)**之前**插入一行「格式」:

```vue
              <div class="info__row">
                <dt>格式</dt>
                <dd>
                  <code>{{ props.iconData.format === 'svg' ? 'svg (sprite)' : 'font' }}</code>
                </dd>
              </div>
```

- [ ] **Step 10: 类型检查(客户端)**

Run: `pnpm build:client`
Expected: 构建成功、无 Vue/TS 报错。

> 若 `pnpm build:client` 因既有无关告警失败,可改用 `pnpm dev:client` 观察 HMR 编译无 error 作为替代验证。

- [ ] **Step 11: 验证详情弹窗(svg)**

Run: `pnpm dev:client`
打开 `multi-heart` 详情。
Expected:
- 标题徽标显示「SVG · 多色」;**无**修复 banner。
- 对比 stage 右侧渲染出多色心形(`<use>`),标签为「Sprite · …」;左侧仍为源 SVG;side/overlay/split 三模式与背景切换正常;旋转/翻转作用于该 `<svg>`。
- 「使用代码」只有 HTML 与 SVG 两个 tab;HTML tab 显示 `<svg aria-hidden="true"><use href="#icon-multi-heart" /></svg>`,可复制。
- 元信息含「格式: svg (sprite)」与「viewBox: 0 0 24 24」。
- 再打开一个 font 图标:徽标恢复字体检测逻辑、修复 banner 行为如旧、四个代码 tab 齐全(回归)。

- [ ] **Step 12: Commit**

```bash
git add src/client/logic/copy.ts src/client/views/DetailsModal.vue
git commit -m "feat(client): adapt detail modal for svg icons (sprite render, snippets, meta)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage(对照 `docs/superpowers/specs/2026-06-23-sprite-output-design.md`):**
- §2 配置结构化(公共 + font/svg + 弃用 srcDir/name)→ Task 1 Step 2/5。✓
- §3 `IconDataItem.format/viewBox`、`UpdatePayload.spritePath` → Task 1 Step 1。✓
- §5.1 spriteGenerator(独立、viewBox、去壳、symbol、写文件、tags 复用、catch resolve、Node>=14 手写递归)→ Task 2 Step 2。✓
- §5.2 统一虚拟模块(JS 入口 + 嵌套 font CSS + fetch/inline 注入 + 幂等)→ Task 3 Step 1/3/4。✓
- §5.2 降级子路径 → 设计保留为 contingency,本计划实现统一入口(已在 spec 注明优先级)。✓(未实现降级路径,符合「优先统一入口」)
- §5.3 常量 → Task 1 Step 3 + Task 2 Step 1 + Task 3 Step 1。✓
- §5.2 index 编排(resolveDir、校验+shim、双轨、watch、save 守卫)→ Task 1 Step 5/6/7 + Task 2 Step 4/5/6/7。✓
- §6.1 客户端合并列表 + 注入 sprite + detectRenderIssues 跳过 svg → Task 4 Step 1/2/3。✓
- §6.2 Main 按 format 渲染 + 角标 + :key → Task 4 Step 4/5/6。✓
- §6.3 DetailsModal 输出切换 + banner 门控 + svg 片段 + viewBox/format 元信息(非破坏)→ Task 5 全。✓
- §7 错误处理(至少一轨校验、目录不存在 ensureDir、catch resolve、跨目录共存)→ Task 1 Step 5 + Task 2 Step 2。✓
- §8 测试/验证(demo 样例 + dev:client + demo:dev + 两 inject 模式 + 单入口)→ Task 2 Step 9/11 + Task 3 Step 8/9 + Task 4 Step 7 + Task 5 Step 11。✓
- §1 stretch(多色进 font 告警)→ 明确推迟,未建任务(符合设计「可选 stretch」)。✓

**Placeholder scan:** 无 TBD/TODO;每个代码步骤给出完整前后代码与行号锚点。

**Type consistency:**
- `format: 'font' | 'svg'`(types.ts)在 fontsGenerator(`'font' as const`)、spriteGenerator(`'svg' as const`)写入;客户端 `item.format === 'svg'` 一致判读。
- `viewBox: string` 三处产出(font/svg 生成器)、消费(Main `<svg :viewBox>`、DetailsModal `<svg :viewBox>`、元信息)。
- `UpdatePayload.spritePath?: string` 产出于 index `regenerate`,消费于 state `injectPreviewSprite`。
- `createSpriteGenerator(root, { svgDir, outputDir, prefix, spriteName })` 定义(Task 2 Step 2)与调用(Task 2 Step 4)签名一致。
- `getSvgUseCode(useId: string)` 定义(Task 5 Step 1)与调用(Task 5 Step 8 `htmlSnippet`)一致。
- 函数改名 `regenerateFont` → `regenerate`:Task 2 Step 5/6 同步改 watch 与 connection 调用,无遗留旧名。
- 常量 `RESOLVED_VIRTUAL_MODULE_ID` 由 CSS 改 JS,`load` 分支(Task 3 Step 3)同步;新增 `VIRTUAL_FONT_CSS_ID`/`RESOLVED_VIRTUAL_FONT_CSS_ID` 定义与 resolveId/load 引用一致。
