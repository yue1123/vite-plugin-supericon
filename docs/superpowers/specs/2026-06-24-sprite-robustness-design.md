# SVG Sprite 生成健壮性加固(svgo 优化 + 自有生成)Design Spec

> 在 P2(`2026-06-23-sprite-output-design.md`)落地 svg/sprite 双轨后,当前 `spriteGenerator.ts` 用「正则去壳」拼 sprite,缺少大量边缘情况处理。本 spec 参考 `vite-plugin-svg-icons` 的健壮性思路,但**职责划分对齐其真实做法**:`svgo` 只负责优化/归一化 svg 内容,`<svg>`→`<symbol>` 的**结构生成由我们自己的代码完成**。
> 日期:2026-06-24 ｜ 关联:`2026-06-23-sprite-output-design.md`、`docs/product-direction.md`

---

## 1. 背景:当前实现的健壮性缺口

`src/node/spriteGenerator.ts` 现状:`readFileSync` → 正则删 `<svg>`/`<?xml>` 壳 → 拼 `<symbol>` → join 成 sprite。按严重程度排序的缺口:

**严重(正确性 bug)**
1. **内部 id 冲突**:所有 symbol 合进一个 SVG 文档,内部图形 id(`<linearGradient id="paint0">`、`clipPath`、`filter`、`mask`)未命名空间化。两个多色图标定义同名渐变 → 合进文档后 `url(#id)` 按规范解析到**第一个**同名元素 → 后者串色。这正是 svg 轨主打的多色场景;且一旦开启 svgo 优化,`cleanupIds` 会把每个文件的内部 id 压成 `a/b/c…`,撞车从「可能」变「必然」。
2. **symbol id 跨目录冲突**:`id = basename(path)`,两个子目录里的 `home.svg` → 同一 `icon-home` symbol id → 后者被静默丢弃。
3. **root `<svg>` 属性丢失**:`.replace(SVG_TAG_REG,'')` 删掉整个根标签,根级 `fill`/`stroke`/`class`/`style` 一并丢失,子元素继承的颜色失效。

**中(解析脆弱)**
4. 正则去壳**对原始用户输入**做解析,脆弱:`SVG_TAG_REG=/<\/*svg[\w\W]*?>/gm` 遇属性值含 `>`、注释含 `svg` 会断;`XML_TAG_REG=/<\?xml.*>/gm` 的 `.` 不跨行;`<!DOCTYPE>` 完全未处理(残留进 body);HTML 注释 `<!-- -->` 未清理;无 BOM 处理;viewBox 正则只认双引号。
5. **viewBox 回退**:硬编码 `0 0 24 24`,未在缺失时从 `width`/`height` 派生。
6. **非法/空文件**:重命名的 PNG、空文件、SPA fallback 的 HTML 会生成损坏的 `<symbol>`。P2 spec §7 写了「跳过 + warn」,实现未做。

**低(性能/细节)**
7. 无 per-file 缓存:改一个图标重读重解析全部文件。
8. `.replace(/\n/g,'')` 只去 `\n`;`statSync` 重复调用等小问题。

---

## 2. 路线决策(已定)

- **引入 `svgo`,但角色收窄为「优化/归一化」**:这与 `vite-plugin-svg-icons` 的真实做法一致——它只调 `optimize(content, svgoOptions)` 做优化 pass,`<svg>`→`<symbol>`、id 重命名等结构生成是另一个库(svg-baker 的 posthtml 管线)干的,不在 svgo 里。我们**不写自定义 svgo 插件**做结构生成。
- **symbol 结构生成 = 我们自己的代码**:在 svgo 的**归一化输出**上做 `<svg …>` → `<symbol id viewBox>` 包装。原 gap 4 的「正则脆弱」之所以危险,是因为对**原始输入**正则;现在对 **svgo 归一化后的输出**(单根、属性双引号、无注释/doctype/BOM)做字符串处理,正则即安全。
- **`prefixIds` 默认开**:内部图形 id 命名空间化(prefix = symbolId)是多色图标在共享 sprite 文档下的正确性前提(见 §1 gap 1)。它是 svgo 原生优化插件、声明式配置,不是我们的生成代码——仍属「svgo 做优化」。由我们注入(prefix 需 per-file 动态值,用户无法静态表达)。
- **svgo 完整配置开放给用户**:`svg.svgo?: boolean | svgo.Config`,用户可完全自定义优化管线(见 §3)。
- **symbol id 策略 = 文件名 + 冲突 warn/跳过**:保持 `id = basename`、`useId = ${prefix}-${id}` 不变(沿用 P2 单一真源);svg 轨内同名 → 警告并跳过后者,**不静默丢图标**。不引入 `[dir]` 模板(零对外 API 变更)。
- **不强制 currentColor**:svg 轨主打多色,默认不把 fill/stroke 改写成 `currentColor`。
- **`engines.node` 提到 `>=16`**:svgo 3.x 需 `^14.17 || >=16`,且 Vite 本身已要求 Node 18+,当前 `">=14"` 已过时。

---

## 3. 处理流程:svgo(优化)→ 我们(生成)

每个文件分两步,职责清晰:

### 步骤 A — svgo 优化/归一化(可被用户完全配置)

```ts
import { optimize, type Config as SvgoConfig } from 'svgo'

// 默认配置:保留 viewBox 的标准优化
const DEFAULT_SVGO: SvgoConfig = {
  plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }]
}
```

`svg.svgo` 语义:
- `true`(默认)→ 用 `DEFAULT_SVGO`。
- `false` → `{ plugins: [] }`:**仍跑 svgo 做解析+序列化归一化**(单根、双引号),但不做优化插件。这样我们的生成步骤仍在干净输出上工作。
- `svgo.Config` → 用户配置**原样**作为优化管线。

**`prefixIds` 注入(默认开)**:在上面得到的 `plugins` 末尾追加我们的 `prefixIds`(prefix = 该文件的 symbolId),除非用户配置里已显式包含 `prefixIds`(则尊重用户的,不重复注入)。`prefix` 用 symbolId 保证跨文件唯一,合进 sprite 后各 symbol 内部引用自洽。

> 即:`finalPlugins = [...(svgo 优化插件), prefixIds({ prefix: symbolId })?]`。svgo 始终作为解析/归一化器运行;`svg.svgo` 只调节「优化激进度」;`prefixIds` 是正确性,默认恒开。

`optimize(rawContent, { ...config, plugins: finalPlugins })` → 干净、单根、双引号的 `<svg …>…</svg>` 字符串。

### 步骤 B — 我们的代码:`<svg>` → `<symbol>`(纯字符串变换,不经 svgo)

`wrapAsSymbol(optimized, symbolId)`:
1. 匹配根开标签 `^\s*<svg\b([^>]*)>`(svgo 归一化后,根标签属性双引号、无杂质,此正则安全);匹配失败 → 返回 `null`(调用方 warn 跳过)。
2. 解析根属性(`/([\w:-]+)="([^"]*)"/g`,双引号安全)。
3. **viewBox**:取 `attrs.viewBox`;缺失但有数值 `width`/`height` → 派生 `0 0 ${parseFloat(w)} ${parseFloat(h)}`(gap 5);两者皆无 → 兜底 `0 0 24 24` 并 warn 该文件缺尺寸。
4. **属性取舍**:删 `width`/`height`/`xmlns`/`xmlns:xlink`/`x`/`y`/原 `id`;**保留**其余(`fill`/`stroke`/`class`/`style`/`role`/`aria-*`/`preserveAspectRatio`,忠实保留 root 继承色,gap 3)。
5. 拼 `<symbol id="${symbolId}" viewBox="${viewBox}"${保留属性}>` + 内层(去掉根开/闭标签)+ `</symbol>`,并返回 `{ symbol, viewBox }`。

> 结构生成是我们的代码、操作 svgo 干净输出;svgo 只做它擅长的优化/归一化。这正是 vite-plugin-svg-icons 的分工(它把生成交给 svg-baker,我们手写以免引入老旧重依赖)。

---

## 4. 每文件校验与跳过(gap 6)

读 `Buffer` → `toString('utf8')` → **剥 BOM**(去掉开头可能存在的 U+FEFF,`content.replace(/^﻿/, '')`)。然后逐道闸:

1. 内容不含 `<svg`(正则 `/<svg[\s>]/i`)→ `warn` 跳过 —— 挡掉重命名的 PNG / 空文件 / SPA fallback HTML。
2. `optimize` 包 `try/catch`:抛错 → `warn` 跳过该文件,**不阻断整张 sprite**。
3. `wrapAsSymbol` 返回 `null`(root 不是 svg)→ `warn` 跳过。
4. `id`(= 文件名,去 `.svg`)在本次 run 已出现 → `warn「duplicate symbol id "<useId>", skipped <relativePath>」`,跳过后者(gap 2,不静默丢图标)。

所有 `warn` 走现有 `error`/`picocolors` 风格的统一日志(单行、带 `[${NAME}]` 前缀)。

---

## 5. mtime 缓存(gap 7)

generator 闭包内持有跨 run 存活的缓存:

```ts
const cache = new Map<string, { mtimeMs: number; symbol: string; item: IconDataItem }>()
```

每次 `run`:
1. `files = walkSvgFiles(svgDir)`(沿用现有手写递归,得绝对路径)。
2. 剔除缓存中本次未 glob 到的条目(已删除文件)。
3. 排序 `files`(确定顺序,保证 sprite/列表稳定 + 重复 id 判定确定性)。
4. 逐文件 `statSync` 取 `mtimeMs`:命中且未变 → 复用 `{symbol, item}`;否则重读 + 步骤 A/B + 构建 `item`,写回缓存。
5. 装配阶段用 `seen: Set<useId>` 做重复检查(§4 闸 4),命中重复则该文件的 symbol 不进 sprite、item 不进列表。

> 改一个图标只重编译它,而非全量重解析。

`IconDataItem` 字段来源:`svg` = **原始**文件文本(详情页查看源码用,未优化);`svgBody` = `wrapAsSymbol` 产出 symbol 的内层内容;`viewBox` = `wrapAsSymbol` 返回值;`tags` = `getTagsFromPath(svgDir, abs)`(复用);`lastModified` = `stat.mtime`。

---

## 6. sprite 装配

沿用现有外壳(symbol 的 `xmlns` 已在步骤 B 删除):

```html
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">{symbols}</svg>
```

`writeFileSync(join(outputDir, `${spriteName}.svg`), sprite)`。无有效文件时仍写空 `<svg></svg>`(不报错)。generator 整体 catch → `resolve([])`(沿用现状,避免 Promise 永挂)。

---

## 7. 接口与签名

`createSpriteGenerator` 入参新增 `svgo`:

```ts
import type { Config as SvgoConfig } from 'svgo'

export interface SpriteGeneratorOptions {
  svgDir: string
  outputDir: string
  prefix: string
  spriteName: string
  svgo?: boolean | SvgoConfig // @default true
}
```

`src/node/options.ts` 的 `SvgTrackOptions` 新增:

```ts
/**
 * svgo 优化配置。
 * - true(默认):标准优化(preset-default,保留 viewBox)
 * - false:不做优化插件(svgo 仅归一化)
 * - svgo.Config:完全自定义优化管线
 * 注:为避免多色图标在 sprite 中串色,插件会自动注入按 symbol 命名空间化内部 id 的
 *     `prefixIds`(prefix=symbolId);若你的配置已含 `prefixIds`,则以你的为准。
 *     自定义配置请保留 viewBox(removeViewBox:false),否则缺尺寸图标会回退默认 viewBox 并告警。
 * @default true
 */
svgo?: boolean | import('svgo').Config
```

---

## 8. 受影响文件清单

| 文件 | 变更 |
|---|---|
| `package.json` | `dependencies` 新增 `svgo`(3.x);`engines.node` `">=14"` → `">=16"` |
| `src/node/spriteGenerator.ts` | **重写**:步骤 A(svgo 优化 + 注入 prefixIds)+ 步骤 B(`wrapAsSymbol` 自有生成)+ 每文件校验跳过 + mtime 缓存 |
| `src/node/options.ts` | `SvgTrackOptions` 新增 `svgo?: boolean | svgo.Config` |
| `src/node/index.ts` | 创建 `spriteGenerator` 时透传 `svg.svgo`(约一行) |
| `src/node/constants.ts` | sprite 不再用 `SVG_TAG_REG`/`XML_TAG_REG`/`SVG_VIEWBOX_REG`(font 轨 `fontsGenerator.ts` 仍用,**保留**这些常量) |
| 客户端 / `src/types.ts` | **无需改**:仍 `<use href="#useId">` 渲染,`IconDataItem` 字段不变 |

---

## 9. 错误处理与边界

- 单个 svg 优化/包装失败 → 跳过该文件并 `warn`,不阻断整张 sprite(§4)。
- 非 svg 文件(PNG/空/HTML)→ 内容检测拦截并 `warn` 跳过(§4 闸 1)。
- svg 轨内 symbol id 重复 → `warn` + 跳过后者(§4 闸 4)。
- `svg.dir` 不存在 → `ensureDirSync` 创建,sprite 为空 `<svg>`,不报错(沿用现状)。
- 既无 viewBox 又无 width/height 的 svg → `wrapAsSymbol` 兜底 `0 0 24 24` 并 `warn` 提示缺尺寸。
- 用户自定义 svgo 配置删了 viewBox 又无 width/height → 同上兜底+告警(不静默坏图)。

---

## 10. 验证(无自动化测试,沿用「demo 手验」约定)

`demo/src/assets/svgicons/` 放置样例并 `pnpm dev:client` / `pnpm build:node`:

1. **多色 id 冲突**:两个不同子目录、各含 `id="paint0_linear"` 同名渐变的多色图标 → 网格/详情页颜色互不串;检查 `node_modules/.supericon/sprite.svg` 内两 symbol 的内部 id 已带不同 symbol 前缀。
2. **同名跨目录**:两个子目录各放一个 `home.svg` → 终端出现 duplicate 警告,仅一个进网格,无静默丢失。
3. **非法文件**:放入重命名的 PNG / 空 `.svg` / 一段 HTML → 终端 warn 跳过,sprite 仍正常生成。
4. **viewBox 派生**:放入有 `width="32" height="32"` 无 viewBox 的 svg → 详情页 viewBox 为 `0 0 32 32`。
5. **root 属性保留**:root 带 `fill="#f00"` 且子元素无 fill 的 svg → 渲染为红色(继承色保留)。
6. **svgo 配置**:`svg: { svgo: false }` 复跑 → sprite 未被最小化但 prefixIds/symbol 包装仍生效;再用 `svg: { svgo: { plugins: [{name:'preset-default'}] } }` 自定义 → 优化按用户配置走,prefixIds 仍自动注入。
7. `pnpm build:node`:`--dts` 类型检查通过(svgo 类型、新增 `svgo?` 自洽)。

---

## 11. 实现顺序(供 writing-plans 参考)

1. `package.json`:加 `svgo` 依赖、提 `engines.node`(先装依赖)。
2. `options.ts`:`SvgTrackOptions.svgo?: boolean | svgo.Config`。
3. `spriteGenerator.ts`:步骤 A(svgo 配置合并 + 注入 prefixIds)+ 步骤 B(`wrapAsSymbol`)+ 校验跳过 + mtime 缓存。
4. `index.ts`:透传 `svg.svgo`。
5. demo 样例 + 上述 7 项手验。
