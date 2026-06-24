# P3:import 模式(核心)Design Spec

> 路线图 §10 的 **P3** 核心部分。在 P2(font/svg 双格式)与 sprite 健壮性加固之后,本 spec 定义 **import 消费模式**:`import { IconHome } from 'virtual:supericon'` → 框架原生组件(v1 仅 Vue),build 时按 import 精确 tree-shake(组件 JS + svg sprite 双双裁剪)。
> 日期:2026-06-24 ｜ 关联:`docs/product-direction.md` §2/§3/§4/§5/§11、`2026-06-23-sprite-output-design.md`、`2026-06-24-sprite-robustness-design.md`

---

## 1. 目标与非目标

**目标(P3 核心)**
- 新增 **import 消费模式**(与现有 class 模式互斥,方向 §2):`import { IconHome } from 'virtual:supericon'` 拿到 **Vue 组件**;font 图标渲染 `<i class>`,svg 图标渲染 `<use>`(多色)。
- **精确 tree-shake**:build 时只打进被 import 的图标——**组件 JS** 靠 Rollup DCE,**svg sprite** 靠 build 期裁剪(只留用到的 symbol)。font 字体文件无法按字形裁剪(单字体文件),保持全量。
- **`.d.ts` 生成**,让 `import { IconHome }` 有类型与补全;随图标增删刷新。
- **命名:扁平唯一 + 冲突报错**(策略①):图标名跨 font+svg 目录全局唯一,`IconHome` 是单一标识符。
- **dev 全量、build 按需**:dev 不裁剪(避免增删 import 触发频繁重建),build 才扫描使用情况裁剪。

**非目标(本轮明确不做)**
- **ESLint 插件**(mode 边界强制)→ P3b,单独一轮。
- **React 等其他框架** → v1 仅 Vue(方向 §5)。
- class 模式行为变更 → 保持现状,仅作为 `mode` 的默认分支。
- 完整 svgo 自定义在 import 轨的额外暴露 → 复用 sprite 健壮性那套既有产出,不另开。

---

## 2. 配置(`src/node/options.ts`)

```ts
export interface Options {
  // …现有公共项(prefix/clearCache/watch/base/open/silent/font/svg)…

  /**
   * 消费模式(与「交付格式 font/svg」正交,两模式互斥)。
   * - 'class'(默认):现状。`import 'virtual:supericon'` 副作用注入 font CSS + sprite;用 `class="icon-x"` / `<use href="#icon-x">`。
   * - 'import':`import { IconHome } from 'virtual:supericon'` 得到组件;`import 'virtual:supericon/register'` 初始化一次。
   * @default 'class'
   */
  mode?: 'class' | 'import'

  /**
   * import 模式下生成 `.d.ts` 的路径(相对项目根);用户需在 tsconfig `include` 带上。
   * `false` 关闭。仅 `mode:'import'` 生效。
   * @default 'supericon.d.ts'
   */
  dts?: string | false
}
```

`prefix` 仍是单一真源:组件名映射到 `useId = ${prefix}-${id}`,svg `<use href="#${useId}">`、font `class="${useId}"`。

---

## 3. 消费模式入口契约

| | class 模式(默认,现状) | import 模式(本轮) |
|---|---|---|
| 初始化 | `import 'virtual:supericon'`(副作用) | `import 'virtual:supericon/register'`(副作用,一次) |
| 使用 | `class="icon-home"` / `<use href="#icon-home">` | `import { IconHome } from 'virtual:supericon'` → `<IconHome/>` |
| 裁剪 | 不裁剪(全量 managed set) | 组件 JS + svg sprite 均按 import 裁剪 |

> 同一 specifier `virtual:supericon` 语义随 `mode` 切换:class 下是副作用注入模块,import 下是可摇除的组件 barrel。两者不会在一个项目里并用(模式互斥)。

---

## 4. 虚拟模块结构(import 模式)

三个虚拟模块,职责分离:

### 4.1 `virtual:supericon` —— 组件 barrel(可摇除)

`resolveId` → `\0virtual-supericon`;`load` 返回:

```js
import { defineComponent, h } from 'vue'
export const IconStar = /*@__PURE__*/ defineComponent({ /* svg 组件 */ })
export const IconHome = /*@__PURE__*/ defineComponent({ /* font 组件 */ })
// …目录下每个图标一行(font + svg 都在此)
```

- `load` 返回 `{ code, moduleSideEffects: false }`;每个 `defineComponent(...)` 前置 `/*@__PURE__*/`,使 Rollup 在**语句级**摇除未被 import 的 `export const IconX`。
- 组件**不内联 symbol、不自注入**;svg 组件只渲染 `<use href="#useId">`,symbol 由 register 加载的 sprite 提供。
- **dev / build 同样产出全部组件**;裁剪交给 build 期的 Rollup DCE(dev 不裁剪)。

### 4.2 `virtual:supericon/register` —— 初始化(副作用,不摇除)

`resolveId` → `\0virtual-supericon-register`;`load` 返回一段加载两个产物的 JS:

```js
import 'virtual:supericon/font.css'          // 仅当配了 font 轨;走 Vite CSS 管线
// + 加载 svg sprite 并幂等注入共享容器(见 §7/§8 dev vs build 两条路径)
```

- 用户入口 `import 'virtual:supericon/register'` 一次,字体 CSS 与 sprite 就位。
- `moduleSideEffects` 默认(真),不被摇除。

### 4.3 `virtual:supericon/font.css` —— 内部嵌套 font CSS(复用现状)

沿用现有实现(`@import` 进 Vite CSS 管线,字体资源 URL 正确)。仅当配了 font 轨。

---

## 5. 组件(Vue,v1)

按图标格式(由所在目录决定)生成不同 render:

- **svg 组件**:`h('svg', { width:size, height:size, style:{color}, ...attrs }, [h('use', { href:'#'+useId })])`,多色;`color` → `style.color`(供 `currentColor` 用)。
- **font 组件**:`h('i', { class: useId, style:{ fontSize:size, color }, ...attrs })`,单色。
- **props**(方向 §5):
  - `size`:默认 `'1em'`。font → `font-size`;svg → `width/height`。
  - `color`:默认不设(继承 `currentColor`)。font → `color`;svg → `color`(经 `currentColor`)。
  - `class` / 其余 attrs:透传根节点(Vue `inheritAttrs` 默认行为)。

> 组件用纯 JS(`defineComponent` + `h`),不经 SFC 编译;v1 只依赖用户项目已装的 `vue`。

---

## 6. 命名与唯一性(策略①)

- **kebab → `Icon` + PascalCase**:按非 `[A-Za-z0-9]` 分段、各段首字母大写、拼接、前缀 `Icon`。`home`→`IconHome`、`arrow-left`→`IconArrowLeft`、`gg-add-r`→`IconGgAddR`。`Icon` 前缀天然规避数字开头(`4k`→`Icon4k` 合法)。
- **sanitize**:丢弃非字母数字分隔符产生的空段;若 sanitize 后只剩 `Icon`(原名全是符号)→ 报错并指明该文件。
- **全局唯一(跨 font+svg)**:合并两轨图标后,两个文件映射到同一 `IconX` → **dev/build 报错**,列出冲突的两个 `relativePath`(import 模式下 `IconHome` 是单一标识符,必须唯一)。这比 class 模式严格(class 下 font/svg 不同命名空间可共存)。
- 映射表:`exportName → { useId, format }`(svg 另需 symbol 串,见 §8)。

---

## 7. dev 行为(全量,不裁剪)

- `virtual:supericon` barrel 恒含**目录下全部**组件;`register` 加载**完整** font.css + **完整** sprite(`fetch` 现有 `node_modules/.supericon/sprite.svg`,与 class 模式同路径)。
- 只在**图标文件增删/改**时(watch)重生成 barrel / sprite / `.d.ts`;**不因**代码里增删 `import { IconX }` 而重建 → 避免频繁构建。
- 复用既有 `spriteGenerator.run()` 产出全量 sprite 文件 + 全量 `IconData`。

---

## 8. build 行为(组件 DCE + sprite 裁剪)

**组件 JS**:Rollup 对 `moduleSideEffects:false` barrel 做 DCE,未被 import 的 `IconX` 连同其 render 一起摇除。

**svg sprite 裁剪**(方向 §11「used 集合在 DCE 之后收集」):

1. `load('\0virtual-supericon-register')`(build 分支):
   ```js
   const ref = this.emitFile({ type: 'asset', name: 'supericon-sprite.svg' }) // 占位,内容稍后填
   // 返回:import 'virtual:supericon/font.css' + fetch(import.meta.ROLLUP_FILE_URL_<ref>).then(r=>r.text()).then(__inject)
   ```
   记下 `ref`(插件实例级)。
2. `generateBundle(_, bundle)`:
   - 收集 **used svg useId**:遍历 `bundle` 里的 chunk 代码,匹配已知 svg `useId`(如出现 `#icon-star`)→ 命中即「用到」。(import 模式静态,DCE 后存活 chunk 才含对应 `<use href="#icon-star">`;误报最坏多留一个 symbol,无正确性问题。)
   - 从 `spriteGenerator` 暴露的 `symbol map`(`useId → <symbol> 串`)按 used 集合拼裁剪后的 sprite。
   - `this.setAssetSource(ref, prunedSprite)`。
3. **font**:font.css + 字体文件始终全量(单字体文件,无法按字形裁剪)。

> `spriteGenerator` 需新增一个只读出口暴露 `useId → symbol` 映射(其内部 mtime 缓存里已有 `symbol`,加个 getter 即可)。
> 裁剪仅走 sprite **资产(fetch)** 路径;`inject:'inline'` 与裁剪不兼容(load 期拿不到 used 集合),import 模式默认走资产路径,inline 留作非目标。

---

## 9. `.d.ts` 生成

- `mode:'import'` 且 `dts !== false` 时,把声明写到 `dts`(默认 `supericon.d.ts`,项目根)。
- 内容:
  ```ts
  // AUTO-GENERATED by vite-plugin-supericon. Do not edit.
  declare module 'virtual:supericon' {
    import type { DefineComponent } from 'vue'
    export type SuperIconProps = { size?: string | number; color?: string }
    export const IconHome: DefineComponent<SuperIconProps>
    export const IconStar: DefineComponent<SuperIconProps>
    // …每个图标一行
  }
  declare module 'virtual:supericon/register' {}
  ```
- watch 时随图标增删刷新;`prefix` 单一真源;用户在 tsconfig `include` 带上 `dts` 路径。

---

## 10. 错误处理与边界

- **命名冲突 / sanitize 失败** → 报错并指明文件(§6)。
- **footgun:用 font 组件却忘 import register** → 字体未加载、图标不可见。v1 靠 `.d.ts` 顶部注释 + README 说明「入口必须 `import 'virtual:supericon/register'` 一次」;dev 下可加一句兜底 warn(正式强制留给 P3b ESLint)。
- **`mode:'import'` 但项目没装 `vue`** → 解析 `vue` 失败时友好报错(v1 仅 Vue)。
- **import 模式下仍写 `class="icon-x"`** → 不报错也能工作(sprite/CSS 由 register 提供),但破坏 tree-shake 前提;属 ESLint(P3b)管辖,本轮不拦。
- generator 失败沿用既有 `resolve([])` / `warn` 策略,不阻断。

---

## 11. 受影响文件清单

| 文件 | 变更 |
|---|---|
| `src/node/options.ts` | 新增 `mode?: 'class'\|'import'`、`dts?: string\|false` |
| `src/node/constants.ts` | 新增 register 虚拟 id(`virtual:supericon/register` ↔ `\0virtual-supericon-register`) |
| `src/node/spriteGenerator.ts` | 暴露只读 `getSymbols(): Map<useId, symbol>`(供 build 裁剪;内部缓存已有) |
| `src/node/importMode.ts` | **新增**:命名转换 + 唯一性校验 + barrel 代码生成 + register 代码生成 + `.d.ts` 写出 |
| `src/node/index.ts` | `mode` 分流:import 模式下 `resolveId`/`load` 走 barrel/register;`emitFile`/`generateBundle` 做 sprite 裁剪;watch 刷新 `.d.ts` |
| `demo/` | 新增 import 模式示例(单独配置/页面或 README 段) |

---

## 12. 验证(无自动化测试,沿用 demo 手验)

import 模式 demo(`mode:'import'`):

1. 入口 `import 'virtual:supericon/register'`;某组件 `import { IconStar, IconHome } from 'virtual:supericon'` 渲染。
2. **dev**:`pnpm demo:dev` → 多色 svg 组件、font 组件均正常;改/增/删图标文件后 HMR 刷新;代码里增删 `import { IconX }` **不**触发图标重建。
3. **build**:`pnpm demo:build` →
   - 产物 JS 只含被 import 的 `IconX`(未 import 的被 DCE,可在 chunk 里 grep 确认缺失);
   - 输出的裁剪 sprite 资产**只含被 import 的 svg symbol**(grep `id="icon-…"` 比对);
   - font.css/字体文件全量。
4. **`.d.ts`**:`supericon.d.ts` 生成、类型可跳转、`<IconStar/>` 有 props 提示。
5. **命名冲突**:font.dir 与 svg.dir 各放一个同名 `home.svg` → 构建报错并列出两路径。
6. **class 模式回归**:`mode` 缺省 → 现有 demo 行为不变。

---

## 13. 实现顺序(供 writing-plans 参考)

1. `options.ts` + `constants.ts`:`mode`/`dts` 与 register 虚拟 id。
2. `importMode.ts`:命名转换 + 唯一性 + barrel/register 代码生成 + `.d.ts` 写出(独立单元,可手验生成串)。
3. `spriteGenerator.ts`:加 `getSymbols()` 出口。
4. `index.ts`:`mode` 分流 resolveId/load;dev 全量路径;build `emitFile`+`generateBundle` 裁剪;watch 刷新 `.d.ts`。
5. demo import 模式示例 + 上述 6 项手验。
