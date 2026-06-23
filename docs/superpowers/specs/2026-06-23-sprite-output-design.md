# P2:SVG Sprite 产出（补齐 font/svg 双格式)Design Spec

> 路线图 §10 的 **P2**。P1(详情页检测 + 一键修复存回 + 子目录分类筛选)已完成。
> 本 spec 定义如何让 `vite-plugin-supericon` 在现有 iconfont 之外**并行产出 svg sprite**,做到 font / svg 双格式平等共存。
> 日期:2026-06-23 ｜ 关联:`docs/product-direction.md` §2/§4/§5/§11、`spec.md`

---

## 1. 目标与非目标

**目标(P2)**
- 新增一条 **svg/sprite 交付轨**,与现有 font 轨平等共存(产品方向 §4)。
- **格式由源目录决定**:`font.dir` 下图标 → font glyph;`svg.dir` 下图标 → svg sprite symbol。每个图标只属于一种格式,无冗余产物。
- sprite 以**独立文件**(`sprite.svg`)产出,经**虚拟模块运行时注入 DOM**消费,避开外链 `<use>` 的 CORS/CSP/跨文档样式三坑(§11)。注入分 `fetch`(外联)/`inline`(内联)两种可配置模式。
- **统一虚拟模块入口**:对外只暴露 `virtual:supericon`,一次 `import 'virtual:supericon'` 同时拿到 font CSS 与 sprite 注入(不再单列 `virtual:supericon-sprite`)。若统一入口实现受阻,降级为子路径 `virtual:supericon`(font)+ `virtual:supericon/svg`(sprite)。
- 预览页**完整适配** svg 格式图标:进网格、可筛选、详情页对比/编辑布局复用,仅把「渲染输出」插槽按格式切换为 sprite `<use>`。
- 配置结构化:公共项在外层,`font` / `svg` 各自成组。

**非目标(明确推迟到 P3 / 后续)**
- `IconHome` 框架原生组件、`import { IconHome } from 'virtual:supericon'` 虚拟模块、`.d.ts` 生成、ESLint 插件 → **P3(import 模式)**。
- 跨目录的 **import 标识符唯一性强制**(产品方向 §4 策略①)→ **P3**。P2 中 font 用 CSS class、sprite 用 SVG id,属不同命名空间(§4 命名空间提示),DOM 不撞;同名同形仍由既有重复检测提示。
- 生产构建的资源 hash / asset pipeline 改造(`TODO-node.md` 既有项)→ 单独跟踪;P2 的 sprite 交付**沿用现有 font 的 `@fs/` 交付路径**,不在本 spec 展开。

**两项已定默认(可在评审时否决)**
- 旧 `srcDir` 提供**弃用 shim**:映射到 `font.dir` 并打印 deprecation `warn`。
- **多色图标进 font 目录的告警**列为**可选 stretch**,非 P2 核心。

---

## 2. 配置(`src/node/options.ts`)

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
   * - 'fetch':运行时 fetch 外联 sprite.svg 后注入(JS chunk 小、可独立缓存)
   * - 'inline':sprite 内容打进虚拟模块字符串,导入时同步注入(无首帧闪烁)
   * @default 'fetch'
   */
  inject?: 'fetch' | 'inline'
  /** sprite 文件名(不含扩展名)@default 'sprite' → sprite.svg */
  spriteName?: string
}

export interface Options {
  // ── 公共 / 插件级 ──
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

  // ── 两条轨道,至少配一条 ──
  font?: FontTrackOptions
  svg?: SvgTrackOptions

  /** @deprecated 用 `font.dir` 代替;P2 起仅做兼容映射 */
  srcDir?: string
  /** @deprecated 用 `font.name` 代替 */
  name?: string
}
```

**规则**
- `font` 与 `svg` **至少配置一个**,否则在 `config` 钩子里友好报错。
- `prefix` 是**单一真源**:font 输出 CSS class `${prefix}-${id}`,sprite 输出 `<symbol id="${prefix}-${id}">`。
- **兼容 shim**:若检测到顶层 `srcDir`(及旧 `name`/font 字段),映射为 `font = { dir: srcDir, name, ... }` 并 `warn` 一次。

---

## 3. 数据模型(`src/types.ts`)

```ts
export interface IconDataItem {
  id: string
  /** font: CSS class;svg: symbol id。两者均为 `${prefix}-${id}` */
  useId: string
  /** 该图标的交付格式;由所属源目录决定 */
  format: 'font' | 'svg'
  svg: string
  svgBody: string
  /** 真实 viewBox(svg symbol 与预览尺寸需要;缺省回退 '0 0 24 24') */
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
  /** sprite.svg 的磁盘绝对路径;无 svg 轨时为 undefined */
  spritePath?: string
  iconList: IconData
}
```

> `font` 与 `svg` 两轨的图标合并进同一个 `iconList`,客户端凭 `format` 分流渲染。`useId` 在两个命名空间(CSS class / DOM id)下即使同名也不在 DOM 冲突;`:key` 用 `format + '/' + id` 以防合并列表里同名键碰撞。

---

## 4. 架构与数据流

```
font.dir ──→ fontsGenerator(fantasticon)──→ iconfont.* + .css  ┐
                                            format:'font' 项     ├─ merge ─→ iconList ─┐
svg.dir  ──→ spriteGenerator(独立)    ──→ sprite.svg           ┘                      │
                                            format:'svg' 项                            │
                                                                                       ▼
                            WS `vite-plugin-supericon:update`  { name, cssPath, spritePath, iconList }
                                                                                       │
                                                            ┌──────────────────────────┴───────────────┐
                                              预览页 client(state.update)            最终用户 app
                                              · 换 font <link>(@fs/cssPath)         · import 'virtual:supericon'(单入口)
                                              · fetch @fs/spritePath → 注入 sprite     → font CSS + sprite 注入
                                              · 按 format 渲染网格/详情               · <i class>/<svg><use href="#id">
```

**单元边界(各自单一职责、接口清晰)**
- `fontsGenerator.ts`:扫 `font.dir` → 字体产物 + `format:'font'` 列表。**仅 font。**
- `spriteGenerator.ts`(新):扫 `svg.dir` → `sprite.svg` + `format:'svg'` 列表。**仅 sprite,不依赖 fantasticon。**
- `index.ts`:编排两台 generator、合并列表、推送 update、注册虚拟模块、保存 RPC。
- 客户端 `state.ts`:接收合并列表、注入 sprite、按 format 分流派生。

---

## 5. Node 端实现

### 5.1 `spriteGenerator.ts`(新文件)

职责:扫描 `svg.dir` 下全部 `*.svg`,产出单文件 sprite 并返回 `format:'svg'` 的 `IconData`。

- 复用 `getTagsFromPath(svgDir, absolutePath)` 派生 `tags`(已存在,作用对象换成 `svg.dir`)。
- 每个文件:
  - `readFileSync` → 原始 `svg`。
  - 提取 `viewBox`(正则取 `<svg ... viewBox="...">`;缺省回退 `0 0 ${width} ${height}` 或 `0 0 24 24`)。
  - 用既有 `SVG_TAG_REG` / `XML_TAG_REG` 去壳得到 `svgBody`(同 font 轨的处理,`.replace(/\n/g,'')` 全量换行)。
  - 组装 `<symbol id="${prefix}-${id}" viewBox="${viewBox}">${svgBody}</symbol>`。
- 汇总写文件:
  ```html
  <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
       style="position:absolute;width:0;height:0;overflow:hidden">
    <symbol .../>…
  </svg>
  ```
  → `writeFileSync(join(outputDir, `${spriteName}.svg`), …)`。
- 接口对齐 `createFontsGenerator`:`createSpriteGenerator(root, { svgDir, outputDir, prefix, spriteName })` 返回 `{ run(force?) }`,内部同样做 `promise` 缓存(并采纳 `TODO-node.md` P0 的 catch resolve 写法,避免永挂)。

> svg sprite **不做** font 的环绕/描边修复:sprite 原样保留路径几何,无 fill-rule 重解释问题,故 svg 图标不参与 winding/stroke 检测。

### 5.2 `index.ts` 编排改动

- **目录解析复用**:把现有 alias 解析(`config` 钩子内,`_srcDir.includes(aliasKey)` 那段)抽成 `resolveDir(config, root, dir): string` helper,`font.dir` / `svg.dir` 各调一次。
- **入口校验**:`font` 与 `svg` 皆缺 → 抛友好错误;`srcDir` shim 映射到 `font`。
- **创建 generator**:按配置创建 `fontsGenerator` / `spriteGenerator`(可只其一)。
- **regenerate**:debounce 内并行 `Promise.all` 跑两台 generator,合并 `iconList`,推送 `update { name, cssPath, spritePath, iconList }`。
- **watch**:`server.watcher.add` 两个 dir;`add/unlink/change` 触发 regenerate。
- **save RPC**:守卫从 `target.startsWith(srcDir)` 放宽为 `font.dir` **或** `svg.dir` 之一前缀命中才写。
- **虚拟模块(统一入口)**:对外只暴露 `virtual:supericon`,一次副作用导入同时拿到 font CSS 与 sprite 注入。
  - `resolveId('virtual:supericon')` → `\0virtual-supericon`(**JS** 模块:去掉 `.css` 后缀,Vite 即按 JS 处理)。
  - `load('\0virtual-supericon')`:先 `await` 已配置的 generator,再按配置拼 JS:
    - **若有 font 轨**:模块顶部 `import 'virtual:supericon/font.css'` —— 内部嵌套 CSS 虚拟模块,保留 Vite CSS 管线。`resolveId('virtual:supericon/font.css')` → `\0virtual-supericon-font.css`(CSS),`load` 返回 `@import` font CSS(即原 CSS 模块逻辑,行为不变)。
    - **若有 svg 轨**,按 `svg.inject`:
      - `inline`:sprite 文本作字符串字面量打进模块 + `injectOnce(str)`。
      - `fetch`:`fetch(SPRITE_URL).then(r=>r.text()).then(injectOnce)`(`SPRITE_URL` dev 走 `@fs/` 路径,构建沿用 font 现状,build 强化另案)。
    - `injectOnce`:幂等,以固定 id/`data-` 标记防重复注入。
  - **行为变化**:`virtual:supericon` 由原 CSS 模块改为 JS 模块;用户侧 `import 'virtual:supericon'`(副作用导入)写法不变,demo 无需改。
  - **降级方案(仅当统一入口受阻时)**:改子路径 —— `virtual:supericon`(font)+ `virtual:supericon/svg`(sprite),两次副作用导入。优先实现统一入口。

### 5.3 常量(`src/node/constants.ts`)

```ts
// 公共入口由 CSS 模块改为 JS 模块(去掉 .css 后缀)
export const VIRTUAL_MODULE_ID = 'virtual:supericon'            // 不变
export const RESOLVED_VIRTUAL_MODULE_ID = '\0virtual-supericon' // 原为 '\0virtual-supericon.css'
// 内部嵌套的 font CSS 虚拟模块(承接原 CSS 逻辑)
export const VIRTUAL_FONT_CSS_ID = 'virtual:supericon/font.css'
export const RESOLVED_VIRTUAL_FONT_CSS_ID = '\0virtual-supericon-font.css'
export const DEFAULT_SPRITE_NAME = 'sprite'
export const SVG_VIEWBOX_REG = /viewBox="([^"]*)"/
```

---

## 6. 客户端 / 预览实现

### 6.1 `state.ts`

- `update(data)`:
  - `list.value = data.iconList`(font + svg 合并)。
  - 维持 font `<link>` 切换(现状)。
  - **注入 sprite**:若 `data.spritePath`,`fetch(`${baseUrl}@fs/${spritePath}?v=…`)` 取文本,替换式注入到预览 DOM(幂等容器),使 svg 图标的 `<use href="#useId">` 在预览中解析;HMR 时重注入。
  - `detectRenderIssues`:**跳过 `format==='svg'`**(winding/stroke 是 font 专属);`check`(重复检测)仍跑全量。
- 可选派生 `availableFormats` / 计数,供未来 format 筛选(P2 不强制做筛选 UI,见 §6.3)。

### 6.2 `Main.vue` 网格卡片

- 渲染输出按 `format` 切换:`font` → `<i :class="icon.useId">`;`svg` → `<svg><use :href="'#' + icon.useId"/></svg>`。
- 卡片加**格式角标**(如 `FONT` / `SVG` 小徽标),与既有重复/冲突角标并列。
- `:key` 用 `icon.format + '/' + icon.id`。

### 6.3 `DetailsModal.vue`(非破坏式改造)

- 既有对比 / 叠加 / 分割 / 背景切换 / 尺寸预设布局**全部保留**。
- **仅「渲染输出」插槽(现 font 字形那侧)按 format 切换**:`svg` 图标用 sprite `<use>`(多色、currentColor)渲染。
- 修复 banner:**仅 `format==='font'`** 显示(svg 不入字体,无需修复)。
- 使用代码片段:`svg` 增补 `<svg><use href="#icon-home"/></svg>` / 内联用法,标注 `currentColor` 与 a11y(`aria-hidden` 装饰 / `role=img`+`aria-label` 功能)。
- 元信息补 `viewBox`、`format`;旋转 / 翻转 / 重命名 / 保存复用现状(保存走既有 save RPC,守卫已放宽)。
- 可选(stretch):工具栏增加「格式」单选筛选(font / svg / 全部),与既有分类筛选并列。**P2 默认不做**,以角标区分即可。

---

## 7. 错误处理与边界

- `font` / `svg` 皆未配置 → `config` 钩子抛错并指明需至少一条轨。
- `svg.dir` 不存在 → `ensureDirSync` 创建空目录,sprite 为空 `<svg>`,不报错(与 font 轨一致)。
- sprite 单个 svg 解析失败(无 viewBox 等)→ 跳过该文件并 `warn`,不阻断整体生成。
- generator catch → `resolve([])`(采纳 TODO-node.md P0),避免 Promise 永挂锁死链路。
- 同名跨目录(`home` 同时在 font.dir 与 svg.dir):P2 允许共存(不同命名空间);若几何相同则既有重复检测以 `sameWith` 提示(信息性,非错误)。

---

## 8. 测试 / 验证

仓库无测试设施(沿用既有约定),P2 **不写自动化测试**,逐项**在 demo 手动验证**:

1. demo 新增 `demo/src/assets/svgicons/`,放入 1 个多色 svg + 1 个子目录(验证 tags)。
2. `pnpm dev:client`:
   - svg 图标进网格并以 `<use>` 渲染(多色正常),带 `SVG` 角标。
   - 分类筛选对 svg 子目录生效。
   - 详情页:对比布局保留,输出侧为 sprite `<use>`;修复 banner 不出现;svg 代码片段正确。
   - `node_modules/.supericon/sprite.svg` 产出,内含对应 `<symbol>`。
   - 切换 `svg.inject: 'inline'` 复跑,确认两种注入模式均生效。
   - 改 / 增 / 删 svg 文件,HMR 后预览刷新。
   - **统一入口**:demo `main.ts` 维持单行 `import 'virtual:supericon'`,确认 font CSS 与 sprite 一次导入全部生效(font 图标有样式、svg 图标 `<use>` 可解析)。
3. `pnpm build:node`:`--dts` 类型检查通过(新增必填 `format`/`viewBox`/`spritePath` 类型自洽)。
4. 兼容 shim:用旧 `srcDir` 配置启动,确认 `warn` + font 轨仍工作。

---

## 9. 受影响文件清单

| 文件 | 变更 |
|------|------|
| `src/node/options.ts` | 重构为公共项 + `font`/`svg` 两组 + 弃用 `srcDir`/`name` |
| `src/types.ts` | `IconDataItem` 增 `format`/`viewBox`;`UpdatePayload` 增 `spritePath` |
| `src/node/constants.ts` | 公共入口改 JS resolved id;新增内部 font CSS 虚拟 id、`DEFAULT_SPRITE_NAME`、`SVG_VIEWBOX_REG` |
| `src/node/fontsGenerator.ts` | 列表项打 `format:'font'` + `viewBox`;catch resolve |
| `src/node/spriteGenerator.ts` | **新增**:扫 `svg.dir` → `sprite.svg` + `format:'svg'` 列表 |
| `src/node/index.ts` | 抽 `resolveDir`;校验 + shim;编排两轨;watch 两 dir;save 守卫放宽;`virtual:supericon` 统一入口(JS)+ 内部 font CSS 嵌套模块 |
| `src/client/logic/state.ts` | 合并列表;注入 sprite;`detectRenderIssues` 跳过 svg |
| `src/client/views/Main.vue` | 网格按 format 渲染 + 格式角标 + `:key` |
| `src/client/views/DetailsModal.vue` | 输出插槽按 format 切换;banner 仅 font;svg 代码片段;viewBox/format 元信息 |
| `demo/` | 新增 `svgicons/` 样例 + 更新 demo 配置 |

---

## 10. 实现顺序(供 writing-plans 参考)

1. 类型与配置(`types.ts` + `options.ts`)— 立地基。
2. `spriteGenerator.ts` + 常量 — 独立单元,可单测式手验产物文件。
3. `index.ts` 编排(双轨、watch、save、虚拟模块)。
4. 客户端 `state.ts`(合并 + 注入 + 跳过检测)。
5. `Main.vue` 网格渲染 + 角标。
6. `DetailsModal.vue` 输出切换 + 片段 + banner 门控。
7. demo 样例 + 双 `inject` 模式手验。
