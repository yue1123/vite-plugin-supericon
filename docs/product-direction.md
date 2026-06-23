# Supericon 产品方向

> 本文是 `vite-plugin-supericon` 后续演进的方向与决策记录,作为正式 spec 的种子。
> 最后更新:2026-06-20
>
> 标记:✅ 已定 ｜ 🔨 进行中/已落地 ｜ ⏳ 推迟 ｜ ❓ 未决

---

## 0. 背景:本次已完成的修复(🔨)

**问题**:部分 SVG 转 iconfont 后镂空消失 / 整块被填实。

**根因**:icon 字体(TTF/OTF/WOFF)只用 **non-zero(非零环绕)规则**填充,且**忽略 SVG 的 `fill-rule`**。`@twbs/fantasticon` 内的 `svgicons2svgfont` 原样拼接路径几何、不修环绕方向(源码无任何 `fill-rule/evenodd/winding/reverse/reorient`)。于是用 `fill-rule="evenodd"` 或同向洞绘制的图标,进字体后镂空被填实。

**修复方法**(`repair-svg.js`):逐路径按各自 `fill-rule` 纠正环绕方向(洞与外轮廓反向)→ 合并为单条路径。等价于 FontForge "Correct Direction" / Figma "Flatten"。

**验证**:用**真实 fantasticon 流水线**对原始 vs 修复 SVG 生成字体并逐像素对比,4 个坏图标从 19~39% 不一致回落到 ~1.4~4%(噪声地板),无回归。验证台见 `svg-font-repair-lab/`。

**依赖**:修复仅需 **paper.js**;因在**浏览器、用户点按钮时运行**(非自动构建),**不需要 jsdom**。`opentype.js` 仅验证台使用,产品不带。

---

## 1. 产品定位(✅)

- **一句话**:**自托管、进仓库、可版本控制的 iconfont.cn / IcoMoon —— 为 Vite 而生**。管理项目图标,产出 **iconfont + svg sprite**,核心卖点是**交互式管理预览页 + 保真检测/修复**。
- **差异化对手**:iconfont.cn / IcoMoon(云锁定、需账号)、vite-plugin-svg-icons(只 sprite、无 UI)。
- **不是**和 unplugin-icons 在"按需组件"赛道竞争——那是另一回事。
- **诚实边界**(写进文档):大库取小用、纯按需 SPA,应推荐 unplugin-icons。本工具面向"要集中管理 + 要 font/sprite 产物"的项目。

---

## 2. 两条正交的轴(✅,核心概念)

务必区分,别混为一谈:

| 轴           | 取值                       | 关系                              |
| ------------ | -------------------------- | --------------------------------- |
| **消费模式** | `import` / `class`         | **互斥**,由 ESLint 插件强制不混用 |
| **交付格式** | `iconfont` / `svg(sprite)` | **平等,可共存**                   |

"不允许混用"针对的是 **import vs class**;**font vs svg** 是另一条轴,二者可共存。

---

## 3. 消费模式契约(✅)

|            | **import 模式**                                | **class 模式**                             |
| ---------- | ---------------------------------------------- | ------------------------------------------ |
| 写法       | `import { IconHome } from 'virtual:supericon'` | `class="icon-home"` / `<use href="#home">` |
| 产物       | 只含静态 import 的(**精确 tree-shake**)        | **整套 managed set**(不裁剪)               |
| 动态名     | 不存在(import 即静态确定)                      | 天然支持(运行时类名)                       |
| tree-shake | 需要,模块图精确                                | **不需要**                                 |
| 体积控制   | 自动(import 决定)                              | 手动(管理 srcDir)                          |
| TS 提示    | 生成 `.d.ts`                                   | (可选)类名联合类型                         |
| 适合       | JS/TS 项目、要最小体积                         | 框架无关 / 纯 CSS / CMS / 动态             |

**关键认识**:

- import 轨**天生静态**,无动态名问题,tree-shake 永远精确。
- class 轨**不裁剪**,所以动态名天然可用;体积靠"管理 srcDir"控制,而非自动裁剪。
- 因此**不需要** class 用量扫描器,也**不需要** safelist/include 机制。

### 3.1 边界强制:ESLint 插件(✅)

- import 模式:禁 `class="icon-*"` 和 `<use href="#icon-*">`。
- class 模式:禁 `import … from 'virtual:supericon'`。
- 规则 **mode-aware**;`prefix`(默认 `icon`)在 Vite 插件与 ESLint 插件间**单一真源**,不两处写死。
- 定位:**ESLint 是 DX 层,非正确性保证**(覆盖不到 HTML/CSS/动态拼接/未 lint 文件)。正确性靠"import 集合自洽"——绕过 lint 最坏只是**缺图标**,不会产出错误 bundle。
- 加一层 **Vite dev 兜底警告**(import 模式扫到 `icon-` 用法就 warn,不承重)。
- 规则清单:`no-icon-class` / `no-icon-use` / `no-virtual-import-in-class-mode`。
- Stretch:`--fix` 把 `<i class="icon-home"/>` 自动改写成 `import { IconHome }` + `<IconHome/>`(迁移利器)。

---

## 4. 交付格式与格式归属(✅)

- **font 与 svg 两种格式平等、可共存。**
- **格式由源目录决定**:`icons/font/*` → font 图标,`icons/svg/*` → svg 图标。`IconHome` 渲染成哪种,由它所在目录决定。
- **命名:扁平唯一 + 冲突报错(策略①)**
  - 图标名字 = **全局唯一身份**,目录只是"组织 + 格式归属",不进入身份。
  - 同名出现在两个目录 → **构建/dev 直接报错**,由预览页"同名冲突"检测高亮,让用户改名。
  - 逃生口(②,opt-in,非默认):`virtual:supericon/svg`、`virtual:supericon/font` 命名空间导入 + 输出 id 带 `[dir]-` 前缀。
- **内容校验(与目录归属互补)**:多色图标放进 font 目录 → **报错/警告**(font 表达不了多色)。这是校验,不是决策。
- **命名空间提示**:font 用 CSS class、sprite 用 SVG id,本属不同命名空间,DOM 不会撞;真正会撞的是导入标识符 `IconHome`——由策略①管。

---

## 5. 组件(✅;v1 仅 Vue)

- `IconHome` = **框架原生组件**,直接用于代码:Vue 项目给 Vue 组件,React 给 React 组件。**v1 先只适配 Vue**。
- 组件按图标格式渲染:
  - **font 组件**:`<i class="icon-home">`,单色。
  - **svg 组件**:`<svg><use href="#home"/></svg>`(或内联),**支持多色**。
  - 组件**引用共享 bundle**,不内联 SVG(区别于 unplugin-icons;同图标多处用 → sprite 里只一个 symbol)。
- **props**:
  - `size`:font → `font-size`;svg → `width/height`。
  - `color`:font → `color`;svg → `fill / currentColor`。
  - **兼容 `class` 样式**:把 `class` 透传到根节点。

---

## 6. 修复能力(🔨;v1)

- **v1 不做全局自动扫描标红,做成详情页检测**:打开某图标详情 → 就着已有的 SVG vs Font 对比 → 检测它在字体下是否会渲染异常 → 提供**一键修复并存回**。
- 修复方法 = `repair-svg.js`(normalize+concat / paper.js / 浏览器端运行)。
- 存回走插件已有的 RPC 写文件能力。

---

## 7. 用量审计(❓优先级低;advisory)

- import 模式:模块图精确,**无需审计**。
- class 模式:全量打包、不 tree-shake;审计**降级为给人看的辅助**,帮用户决定哪些 svg 可从 srcDir 删除(手动瘦身),**永不自动删**。对动态名不准也没关系,因有人复核。
- 想给 class 模式瘦身,用**配置级 glob include/exclude 源文件**,不是用量扫描。

---

## 8. 架构(⏳ 框架推迟)

- 形态:**core**(统一 IconModel 注册表 + watch + repair + 预览 + RPC)+ **provider**(Source:本地 svg/未来 Iconify;Output:font/sprite)。
- 两条适配器轴:Source Provider(来源)与 Output Provider(产物),别用一个上帝接口。
- **适配器框架推迟**(YAGNI):v1 先用具体实现(font/sprite + Vue)跑通,逼出接口再决定要不要抽象、要不要上多框架。
- 难点优先级最高的是**统一 IconModel**(id / viewBox / body / source / format / hash / mtime / needsRepair):它定对了适配器很轻。

---

## 9. 依赖

- 修复:**paper.js**(浏览器用 `paper-core` 构建)。
- **不需要 jsdom**(浏览器端运行)。
- `opentype.js`:仅验证台 `svg-font-repair-lab/` 使用,产品不带。

---

## 10. 路线图 / 优先级(✅)

| 优先级 | 内容                                         | 状态                 |
| ------ | -------------------------------------------- | -------------------- |
| **P1** | 详情页检测 + 一键修复存回                    | [✅已完成]修复核心已完成,接 UI |
| **P2** | sprite 产出(补齐 font/svg 双格式)            | 待做                 |
| **P3** | import 模式(虚拟模块 + `.d.ts`)+ ESLint 插件 | 待做                 |
| **P4** | 用量审计(advisory,服务 class 模式手动瘦身)   | 待做                 |
| **v2** | Iconify 导入面板(含 license 记录)            | ⏳ 推迟              |
| later  | 适配器框架抽象、多框架(React 等)             | ⏳ 推迟              |

---

## 11. 实现要点备忘(gotchas)

- **import 轨**:barrel 再导出 per-icon 虚拟子模块(`moduleSideEffects:false`);used 集合在 **DCE 之后**从存活模块图收集(transform 阶段就收会把被 shake 掉的也算进来);组件引用共享 bundle 不内联。
- **`.d.ts` 生成**:watch 时随图标增删刷新;路径可配(如 `dts: 'supericon.d.ts'`),用户在 tsconfig `include` 带上;`prefix` 单一真源。
- **命名转换**:kebab → PascalCase + `Icon` 前缀;非法标识符(`4k`、纯数字开头)需 sanitize 或降级到 class 轨并标出;冲突报错。
- **sprite 交付**:运行时内联注入 DOM(避开外链 `<use>` 的 CORS/CSP/样式三坑);`currentColor`;a11y(`aria-hidden` 装饰用,`role=img`+`aria-label` 功能用,放外层 `<svg>`)。
- **font 交付**:PUA 可访问性(`aria-hidden` + 文本替代)、非零环绕(靠 repair)、单色、描边需先轮廓化(⏳ 未覆盖)。

---

## 12. 仍未决(❓)

- 描边类图标的"描边转轮廓"(stroke→outline)是否纳入、何时做。
- font/svg 组件 `size`/`color` 的精确取值与默认值细节。
- 适配器框架是否真做、何时做(P 之后再评估)。
