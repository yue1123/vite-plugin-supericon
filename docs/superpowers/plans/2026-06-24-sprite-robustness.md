# SVG Sprite 生成健壮性加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用「svgo 优化 + 自有 symbol 生成」重写 `spriteGenerator`,补齐内部 id 命名空间、root 属性保留、viewBox 派生、非法文件跳过、id 冲突处理与 mtime 缓存等健壮性。

**Architecture:** 两步流水线——(A) `svgo.optimize()` 做优化/归一化,并按需注入 `prefixIds`(prefix=symbolId)给图标内部图形 id 命名空间化;(B) 我们自己的 `wrapAsSymbol` 在 svgo 干净输出上把根 `<svg>` 包成 `<symbol>`、设 id、派生 viewBox、保留 root 继承色。symbol id 仍由我方按 `${prefix}-${basename}` 生成。

**Tech Stack:** TypeScript 6、tsup(ESM + dts)、svgo 3.x、pnpm catalog 依赖、Vite 8。仓库**无自动化测试设施**,验证 = `pnpm build:node`(类型/dts)+ demo 构建后读取产出的 `sprite.svg` 断言。

## Global Constraints

- 依赖声明走 pnpm catalog:运行时依赖加进 `pnpm-workspace.yaml` 的 `catalogs.prod`,`package.json` 用 `catalog:prod` 引用。
- `engines.node`:`">=14"` → `">=16"`(svgo 3.x 需 `^14.17 || >=16`)。
- symbol id / useId 规则**不变**:`id = basename(file,'.svg')`,`useId = ${prefix}-${id}`,`<symbol id="${useId}">`,`<use href="#${useId}">`。
- 客户端与 `src/types.ts` **不改**(仍 `<use>` 渲染,`IconDataItem` 字段不变)。
- 单文件失败不阻断整张 sprite;所有跳过/回退走统一 `warn`(`[${NAME}]` 前缀、picocolors 黄色)。
- font 轨常量 `SVG_TAG_REG`/`XML_TAG_REG`/`SVG_VIEWBOX_REG` 仍被 `fontsGenerator.ts` 使用,**保留**。

---

### Task 1: 加入 svgo 依赖、提升 engines、扩展 options 类型

**Files:**
- Modify: `pnpm-workspace.yaml`(`catalogs.prod` 增 `svgo`)
- Modify: `package.json`(`dependencies` 增 `svgo: catalog:prod`;`engines.node` → `>=16`)
- Modify: `src/node/options.ts`(`SvgTrackOptions` 增 `svgo?`)

**Interfaces:**
- Produces: `SvgTrackOptions.svgo?: boolean | import('svgo').Config`

- [ ] **Step 1: 在 `pnpm-workspace.yaml` 的 `catalogs.prod` 增加 svgo**

在 `prod:` 段(与 `sirv` 同级)增加:
```yaml
    svgo: ^3.3.2
```

- [ ] **Step 2: `package.json` 增加依赖并提 engines**

`dependencies` 段增加(按字母序靠近 `sirv`):
```json
    "svgo": "catalog:prod"
```
`engines` 改为:
```json
  "engines": {
    "node": ">=16"
  },
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`
Expected: 安装成功,`node_modules/.pnpm` 下出现 `svgo@3.x`。

- [ ] **Step 4: 扩展 `SvgTrackOptions`**

在 `src/node/options.ts` 顶部加类型导入:
```ts
import type { Config as SvgoConfig } from 'svgo'
```
在 `SvgTrackOptions` 接口内(`spriteName` 之后)加字段:
```ts
  /**
   * svgo 优化配置。
   * - true(默认):标准优化(preset-default,保留 viewBox)
   * - false:不做优化插件(svgo 仅归一化)
   * - svgo.Config:完全自定义优化管线
   * 注:为避免多色图标在 sprite 中串色,插件会自动注入按 symbol 命名空间化内部 id 的
   *     `prefixIds`(prefix=symbolId);若你的配置已含 `prefixIds`,以你的为准。
   *     自定义配置请保留 viewBox(removeViewBox:false),否则缺尺寸图标会回退默认 viewBox 并告警。
   * @default true
   */
  svgo?: boolean | SvgoConfig
```

- [ ] **Step 5: 类型检查**

Run: `pnpm build:node`
Expected: 构建通过,`dist/index.d.ts` 生成,无类型错误(此时 generator 尚未用 svgo,只验证类型/依赖可解析)。

- [ ] **Step 6: 提交**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml src/node/options.ts
git commit -m "feat(node): add svgo dep, bump engines, expose svg.svgo option"
```

---

### Task 2: 给 `utils.ts` 增加 `warn` 日志助手

**Files:**
- Modify: `src/node/utils.ts`(参照现有 `error` 增 `warn`)
- Test: 见 Step 2(读源码确认导出)

**Interfaces:**
- Produces: `warn(message: string): void` —— 黄色、带 `[${NAME}]` 前缀的单行告警。

- [ ] **Step 1: 查看现有 `error` 实现以对齐风格**

Run: `grep -n "export const error\|export function error\|picocolors\|import c\|NAME" src/node/utils.ts`
Expected: 看到 `error` 如何用 picocolors 与 `NAME` 拼前缀。

- [ ] **Step 2: 按相同风格新增 `warn`**

在 `src/node/utils.ts` 内,紧邻 `error` 增加(若 `error` 形如 `export const error = (msg) => console.error(c.red(`[${NAME}] ${msg}`))`,则 `warn` 对应):
```ts
export const warn = (msg: string) => console.warn(c.yellow(`[${NAME}] ${msg}`))
```
> 若该文件里 `c`/`NAME` 的导入名不同,沿用文件内已有的导入标识符;若 `error` 的实现签名不同,`warn` 镜像之。

- [ ] **Step 3: 类型检查**

Run: `pnpm build:node`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add src/node/utils.ts
git commit -m "feat(node): add warn() logger helper"
```

---

### Task 3: 重写 `spriteGenerator.ts`(svgo 管线 + wrapAsSymbol + 校验 + 缓存)

**Files:**
- Modify(全量重写): `src/node/spriteGenerator.ts`

**Interfaces:**
- Consumes: `warn` from `./utils`(Task 2);`getTagsFromPath` from `./fontsGenerator`;`optimize, Config` from `svgo`(Task 1)。
- Produces: `createSpriteGenerator(root: string, options: SpriteGeneratorOptions)` 返回 `{ run(force?: boolean): Promise<IconData> }`;`SpriteGeneratorOptions` 增 `svgo?: boolean | SvgoConfig`。行为/返回结构与现状一致(供 `index.ts` 无改动消费)。

- [ ] **Step 1: 用以下完整内容替换 `src/node/spriteGenerator.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync, statSync, type Stats } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { ensureDirSync } from 'fs-extra'
import { optimize, type Config as SvgoConfig } from 'svgo'

import { IconData, IconDataItem } from '../types'
import { error, warn } from './utils'
import { getTagsFromPath } from './fontsGenerator'

export interface SpriteGeneratorOptions {
  svgDir: string
  outputDir: string
  prefix: string
  spriteName: string
  /** svgo 优化:true=默认优化(保留 viewBox),false=仅归一化,Config=自定义。@default true */
  svgo?: boolean | SvgoConfig
}

/** root <svg> 上需要丢弃的属性(viewBox 单独显式处理) */
const DROP_ATTRS = new Set(['width', 'height', 'xmlns', 'xmlns:xlink', 'x', 'y', 'id', 'viewBox'])

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

/** 解析根标签属性串(svgo 归一化后属性均为双引号,正则安全)。 */
function parseRootAttrs(attrsStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrsStr))) attrs[m[1]] = m[2]
  return attrs
}

/**
 * 组装最终 svgo 配置:按 svg.svgo 选优化插件,并按需注入按 symbol 命名空间化内部 id 的 prefixIds。
 * - false → 不做优化插件(svgo 仅归一化)
 * - true / undefined → preset-default(保留 viewBox)
 * - Config → 透传用户配置(plugins 缺省时回退到保留 viewBox 的 preset-default)
 */
function buildSvgoConfig(svgo: boolean | SvgoConfig | undefined, symbolId: string): SvgoConfig {
  const presetDefault = { name: 'preset-default', params: { overrides: { removeViewBox: false } } }
  let extra: Record<string, unknown> = {}
  let plugins: any[]
  if (svgo === false) {
    plugins = []
  } else if (svgo === true || svgo == null) {
    plugins = [presetDefault]
  } else {
    const { plugins: userPlugins, ...rest } = svgo
    extra = rest as Record<string, unknown>
    plugins = [...((userPlugins as any[]) ?? [presetDefault])]
  }
  const hasPrefix = plugins.some((p) => (typeof p === 'string' ? p === 'prefixIds' : p?.name === 'prefixIds'))
  if (!hasPrefix) plugins.push({ name: 'prefixIds', params: { prefix: symbolId } })
  return { ...extra, plugins }
}

/**
 * 在 svgo 归一化输出上把根 <svg> 包装成 <symbol>。
 * 根不是 svg → 返回 null(调用方 warn 跳过)。
 */
function wrapAsSymbol(
  optimized: string,
  symbolId: string,
  onMissingViewBox: () => void
): { symbol: string; body: string; viewBox: string } | null {
  const open = optimized.match(/<svg\b([^>]*)>/i)
  if (!open || open.index == null) return null
  const attrs = parseRootAttrs(open[1])

  let viewBox = attrs.viewBox
  if (!viewBox) {
    const w = parseFloat(attrs.width)
    const h = parseFloat(attrs.height)
    if (w > 0 && h > 0) viewBox = `0 0 ${w} ${h}`
  }
  if (!viewBox) {
    onMissingViewBox()
    viewBox = '0 0 24 24'
  }

  const kept = Object.keys(attrs)
    .filter((k) => !DROP_ATTRS.has(k))
    .map((k) => ` ${k}="${attrs[k]}"`)
    .join('')

  const start = open.index + open[0].length
  const body = optimized.slice(start).replace(/<\/svg>\s*$/i, '')
  const symbol = `<symbol id="${symbolId}" viewBox="${viewBox}"${kept}>${body}</symbol>`
  return { symbol, body, viewBox }
}

export function createSpriteGenerator(root: string, options: SpriteGeneratorOptions) {
  const { svgDir, outputDir, prefix, spriteName, svgo } = options
  const cache = new Map<string, { mtimeMs: number; symbol: string; item: IconDataItem }>()
  let promise: Promise<IconData> | undefined

  function buildOne(absolutePath: string, stat: Stats): { symbol: string; item: IconDataItem } | null {
    const rel = relative(root, absolutePath)
    const raw = readFileSync(absolutePath).toString('utf8').replace(/^﻿/, '')
    if (!/<svg[\s>]/i.test(raw)) {
      warn(`not an svg, skipped ${rel}`)
      return null
    }
    const id = basename(absolutePath, '.svg')
    const useId = `${prefix}-${id}`

    let optimized: string
    try {
      optimized = optimize(raw, buildSvgoConfig(svgo, useId)).data
    } catch (err: any) {
      warn(`svgo optimize failed for ${rel}: ${err?.message || err}`)
      return null
    }

    const wrapped = wrapAsSymbol(optimized, useId, () =>
      warn(`missing viewBox/size, fell back to "0 0 24 24": ${rel}`)
    )
    if (!wrapped) {
      warn(`root is not <svg>, skipped ${rel}`)
      return null
    }

    const item: IconDataItem = {
      id,
      useId,
      format: 'svg',
      absolutePath,
      svg: raw,
      svgBody: wrapped.body,
      viewBox: wrapped.viewBox,
      relativePath: rel,
      lastModified: stat.mtime,
      tags: getTagsFromPath(svgDir, absolutePath)
    }
    return { symbol: wrapped.symbol, item }
  }

  const run = (force?: boolean): Promise<IconData> => {
    if (promise && !force) return promise
    ensureDirSync(svgDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve) => {
      try {
        const files = walkSvgFiles(svgDir).sort()
        const present = new Set(files)
        for (const key of [...cache.keys()]) if (!present.has(key)) cache.delete(key)

        const symbols: string[] = []
        const data: IconData = []
        const seen = new Set<string>()

        for (const absolutePath of files) {
          const stat = statSync(absolutePath)
          let entry = cache.get(absolutePath)
          if (!entry || entry.mtimeMs !== stat.mtimeMs) {
            const built = buildOne(absolutePath, stat)
            if (!built) continue
            entry = { mtimeMs: stat.mtimeMs, symbol: built.symbol, item: built.item }
            cache.set(absolutePath, entry)
          }
          if (seen.has(entry.item.useId)) {
            warn(`duplicate symbol id "${entry.item.useId}", skipped ${entry.item.relativePath}`)
            continue
          }
          seen.add(entry.item.useId)
          symbols.push(entry.symbol)
          data.push(entry.item)
        }

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

- [ ] **Step 2: 类型检查 / 构建**

Run: `pnpm build:node`
Expected: 通过,`dist/index.js` + `dist/index.d.ts` 生成,无类型错误。

- [ ] **Step 3: 提交**

```bash
git add src/node/spriteGenerator.ts
git commit -m "feat(node): rewrite sprite generator with svgo pipeline (id namespacing, viewBox derive, validation, mtime cache)"
```

---

### Task 4: 透传 `svg.svgo` 并以 demo 端到端验证

**Files:**
- Modify: `src/node/index.ts`(创建 `spriteGenerator` 处透传 `svgo`)
- Create(demo 示例,可保留以展示能力):
  - `demo/src/assets/svgicons/grad/heart.svg`
  - `demo/src/assets/svgicons/grad/star.svg`
  - `demo/src/assets/svgicons/sized/box.svg`

**Interfaces:**
- Consumes: `createSpriteGenerator` 的 `svgo` 入参(Task 3)。

- [ ] **Step 1: `index.ts` 透传 svgo**

在 `src/node/index.ts` 中 `createSpriteGenerator(root, { svgDir, outputDir: distDir, prefix, spriteName })` 调用处,增加 `svgo: svg.svgo`:
```ts
        spriteGenerator = createSpriteGenerator(root, {
          svgDir,
          outputDir: distDir,
          prefix,
          spriteName,
          svgo: svg.svgo
        })
```

- [ ] **Step 2: 新增多色 id 冲突示例(同名内部渐变,不同 symbol)**

`demo/src/assets/svgicons/grad/heart.svg`:
```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint0_linear" x1="0" y1="0" x2="24" y2="24"><stop stop-color="#FF4D6D"/><stop offset="1" stop-color="#FFB36B"/></linearGradient></defs><path fill="url(#paint0_linear)" d="M12 21s-7-4.6-9.3-9C1 8.6 2.7 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.3 0 5 3.6 3.3 7C19 16.4 12 21 12 21z"/></svg>
```
`demo/src/assets/svgicons/grad/star.svg`:
```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="paint0_linear" x1="0" y1="0" x2="24" y2="24"><stop stop-color="#3B82F6"/><stop offset="1" stop-color="#22D3A5"/></linearGradient></defs><path fill="url(#paint0_linear)" d="M12 2l2.9 6.3 6.8.8-5 4.6 1.3 6.7L12 18.9 5.9 21l1.3-6.7-5-4.6 6.8-.8L12 2z"/></svg>
```

- [ ] **Step 3: 新增缺 viewBox(仅 width/height)示例**

`demo/src/assets/svgicons/sized/box.svg`:
```svg
<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="24" height="24" rx="4" fill="#10B981"/></svg>
```

- [ ] **Step 4: 构建插件再构建 demo,产出 sprite**

Run: `pnpm build:node && pnpm demo:build`
Expected: 两步均成功;生成 `demo/node_modules/.supericon/sprite.svg`。

- [ ] **Step 5: 断言 sprite 内容(命名空间 / viewBox 派生 / 符号 id)**

Run:
```bash
node -e "const s=require('fs').readFileSync('demo/node_modules/.supericon/sprite.svg','utf8'); \
const ids=[...s.matchAll(/\bid=\"([^\"]+)\"/g)].map(m=>m[1]); \
const dup=ids.filter((v,i)=>ids.indexOf(v)!==i); \
console.log('symbols:', ['icon-heart','icon-star','icon-box'].map(x=>({[x]:s.includes('id=\"'+x+'\"')}))); \
console.log('box viewBox 0 0 32 32:', /id=\"icon-box\" viewBox=\"0 0 32 32\"/.test(s)); \
console.log('duplicate ids in whole sprite:', dup);"
```
Expected:
- `icon-heart` / `icon-star` / `icon-box` 三个 symbol id 都存在;
- `box viewBox 0 0 32 32: true`(从 width/height 派生);
- `duplicate ids in whole sprite: []`(heart 与 star 的内部渐变 id 已被 prefixIds 按各自 symbol 命名空间化,无重复 → 不会串色)。

- [ ] **Step 6: 验证跳过行为(临时坏文件,验完即删)**

```bash
# 非 svg 的 .svg、空文件、以及同名跨目录(重复 useId)
mkdir -p demo/src/assets/svgicons/_tmp/a demo/src/assets/svgicons/_tmp/b
printf '<html>not an svg</html>' > demo/src/assets/svgicons/_tmp/fake.svg
printf '' > demo/src/assets/svgicons/_tmp/empty.svg
printf '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>' > demo/src/assets/svgicons/_tmp/a/dupe.svg
printf '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>' > demo/src/assets/svgicons/_tmp/b/dupe.svg
pnpm demo:build 2>&1 | grep -i "supericon" || true
node -e "const s=require('fs').readFileSync('demo/node_modules/.supericon/sprite.svg','utf8'); \
const c=(s.match(/id=\"icon-dupe\"/g)||[]).length; \
console.log('icon-dupe count (expect 1):', c, '| icon-fake absent:', !s.includes('icon-fake'), '| icon-empty absent:', !s.includes('icon-empty'));"
rm -rf demo/src/assets/svgicons/_tmp
```
Expected: 终端出现 `[vite-plugin-supericon] not an svg, skipped …fake.svg`、`…empty.svg` 及 `duplicate symbol id "icon-dupe", skipped …`;脚本输出 `icon-dupe count (expect 1): 1 | icon-fake absent: true | icon-empty absent: true`。

- [ ] **Step 7: 验证 svgo 配置开关(false / 自定义)不报错**

Run(临时改 demo/vite.config.ts 的 `svg` 块为 `svg: { dir: './src/assets/svgicons', svgo: false }`,构建,再改回):
```bash
pnpm demo:build
node -e "const s=require('fs').readFileSync('demo/node_modules/.supericon/sprite.svg','utf8'); console.log('icon-heart present with svgo:false:', s.includes('id=\"icon-heart\"'));"
```
Expected: `icon-heart present with svgo:false: true`(svgo 关优化时 symbol 包装与 prefixIds 仍生效)。验证后把 `svgo: false` 删除还原。

- [ ] **Step 8: 提交**

```bash
git add src/node/index.ts demo/src/assets/svgicons
git commit -m "feat(node): pass svg.svgo through; add demo fixtures for sprite robustness"
```

---

## Self-Review 备忘(已核对)

- **Spec 覆盖**:gap 1=prefixIds 注入(T3)+ Step5 去重断言;gap 2=去重 warn(T3)+ Step6;gap 3=wrapAsSymbol 保留属性(T3);gap 4=对 svgo 归一化输出做解析(T3);gap 5=viewBox 派生(T3)+ Step5;gap 6=校验闸(T3)+ Step6;gap 7=mtime cache(T3);gap 8=单次 stat + sort(T3)。配置开放=`svg.svgo`(T1)+ Step7。engines=T1。
- **占位符**:无 TBD;每个改动步骤给出完整代码/命令与期望输出。
- **类型一致性**:`createSpriteGenerator(root, options)`、`run(force?)`、`SvgoConfig`、`warn(msg)`、`wrapAsSymbol(...)` 返回 `{symbol,body,viewBox}` 在各任务间一致。
- **风险点**:`utils.ts` 里 `c`/`NAME` 导入名以文件实际为准(T2 Step1 先查);svgo `optimize().data` 为 string(svgo 3);若 dts 对 `plugins:any[]` 报错则保持 `any[]` 不收紧。
