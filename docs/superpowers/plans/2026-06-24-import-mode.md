# P3 import 模式(核心)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `mode:'import'`,让 `import { IconHome } from 'virtual:supericon'` 得到 Vue 组件,build 时按 import 精确裁剪(组件 JS 走 Rollup DCE,svg sprite 走 generateBundle 裁剪)。

**Architecture:** import 模式下 `virtual:supericon` = 可摇除组件 barrel(`moduleSideEffects:false` + `/*@__PURE__*/`);`virtual:supericon/register` = 副作用初始化(加载 font.css + svg sprite)。纯代码生成放 `importMode.ts`;插件上下文相关(emitFile/generateBundle/dev fetch/dts 写出/冲突报错)放 `index.ts`。dev 全量、build 按需。

**Tech Stack:** TypeScript 6、tsup(ESM+dts)、Vite/Rollup 插件钩子(resolveId/load/generateBundle、`this.emitFile`/`this.setAssetSource`/`import.meta.ROLLUP_FILE_URL_*`)、Vue 3(`defineComponent`/`h`,用户侧依赖)。仓库**无自动化测试**,验证 = `pnpm build:node`(类型/dts)+ demo dev/build 产物断言。

## Global Constraints

- `mode?: 'class' | 'import'`,默认 `'class'`;class 模式行为**保持现状不变**。
- 两模式互斥;`prefix`(默认 `icon`)单一真源:`useId = ${prefix}-${id}`,svg `<use href="#${useId}">`、font `class="${useId}"`。
- import 模式 `virtual:supericon` 的 `load` 必须返回 `{ code, moduleSideEffects: false }`;每个组件 `export const IconX = /*@__PURE__*/ defineComponent({...})`。
- 命名:kebab→`Icon`+PascalCase;跨 font+svg 全局唯一,冲突 → 抛错列出两个 relativePath;sanitize 后只剩 `Icon` → 抛错。
- dev 不裁剪(全量);build 才裁剪。svg sprite 裁剪走 fetch/asset 路径(非 inline)。font 字体始终全量。
- `.d.ts` 默认 `supericon.d.ts`(项目根),`dts:false` 关闭;随图标增删刷新。
- v1 仅 Vue。

---

### Task 1: 配置与常量(`mode` / `dts` / register 虚拟 id)

**Files:**
- Modify: `src/node/options.ts`
- Modify: `src/node/constants.ts`

**Interfaces:**
- Produces: `Options.mode?: 'class'|'import'`、`Options.dts?: string|false`;常量 `VIRTUAL_REGISTER_ID = 'virtual:supericon/register'`、`RESOLVED_VIRTUAL_REGISTER_ID = '\0virtual-supericon-register'`、`DEFAULT_DTS = 'supericon.d.ts'`。

- [ ] **Step 1: `options.ts` 增加 `mode`/`dts`**

在 `Options` 接口(`silent` 之后、`font` 之前)加:
```ts
  /**
   * 消费模式(与交付格式 font/svg 正交,两模式互斥)。
   * - 'class'(默认):`import 'virtual:supericon'` 副作用注入;用 `class="icon-x"` / `<use href="#icon-x">`。
   * - 'import':`import { IconHome } from 'virtual:supericon'` 得组件;`import 'virtual:supericon/register'` 初始化一次。
   * @default 'class'
   */
  mode?: 'class' | 'import'
  /**
   * import 模式生成 `.d.ts` 的路径(相对项目根),用户需在 tsconfig `include` 带上;`false` 关闭。
   * @default 'supericon.d.ts'
   */
  dts?: string | false
```

- [ ] **Step 2: `constants.ts` 增加 register 与 dts 常量**

在 `constants.ts` 末尾追加:
```ts
export const VIRTUAL_REGISTER_ID = 'virtual:supericon/register'
export const RESOLVED_VIRTUAL_REGISTER_ID = '\0virtual-supericon-register'
export const DEFAULT_DTS = 'supericon.d.ts'
```

- [ ] **Step 3: 类型检查**

Run: `pnpm build:node`
Expected: 通过(此时仅加了类型/常量,未消费)。

- [ ] **Step 4: 提交**

```bash
git add src/node/options.ts src/node/constants.ts
git commit -m "feat(node): add mode/dts options and register virtual-module constants"
```

---

### Task 2: `importMode.ts` —— 纯代码生成(命名/metas/barrel/dts)

**Files:**
- Create: `src/node/importMode.ts`

**Interfaces:**
- Consumes: `IconData`、`IconDataItem` from `../types`。
- Produces:
  - `toExportName(id: string): string`
  - `type IconMeta = { exportName: string; useId: string; format: 'font'|'svg'; relativePath: string }`
  - `type Conflict = { reason: 'duplicate'|'invalid-name'; exportName?: string; paths: string[] }`
  - `buildIconMetas(iconList: IconData): { metas: IconMeta[]; conflicts: Conflict[] }`
  - `generateBarrel(metas: IconMeta[]): string`
  - `generateDts(metas: IconMeta[]): string`

- [ ] **Step 1: 创建 `src/node/importMode.ts`**

```ts
import { IconData } from '../types'

export type IconMeta = {
  exportName: string
  useId: string
  format: 'font' | 'svg'
  relativePath: string
}

export type Conflict = {
  reason: 'duplicate' | 'invalid-name'
  exportName?: string
  paths: string[]
}

/** kebab/任意分隔 → `Icon` + PascalCase。`home`→`IconHome`、`arrow-left`→`IconArrowLeft`、`4k`→`Icon4k`。 */
export function toExportName(id: string): string {
  const pascal = id
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('')
  return 'Icon' + pascal
}

/** 合并 font+svg 列表 → 导出元信息;检测全局命名冲突与非法名。 */
export function buildIconMetas(iconList: IconData): { metas: IconMeta[]; conflicts: Conflict[] } {
  const metas: IconMeta[] = []
  const byName = new Map<string, IconMeta>()
  const conflicts: Conflict[] = []
  for (const item of iconList) {
    const exportName = toExportName(item.id)
    if (exportName === 'Icon') {
      conflicts.push({ reason: 'invalid-name', paths: [item.relativePath] })
      continue
    }
    const existing = byName.get(exportName)
    if (existing) {
      conflicts.push({ reason: 'duplicate', exportName, paths: [existing.relativePath, item.relativePath] })
      continue
    }
    const meta: IconMeta = {
      exportName,
      useId: item.useId,
      format: item.format,
      relativePath: item.relativePath
    }
    byName.set(exportName, meta)
    metas.push(meta)
  }
  return { metas, conflicts }
}

function componentCode(m: IconMeta): string {
  const head =
    `export const ${m.exportName} = /*@__PURE__*/ defineComponent({\n` +
    `  name: ${JSON.stringify(m.exportName)},\n` +
    `  props: { size: { default: '1em' }, color: { default: undefined } },\n`
  if (m.format === 'svg') {
    return (
      head +
      `  setup(props) { return () => h('svg', { width: props.size, height: props.size, style: { color: props.color } }, [h('use', { href: '#${m.useId}' })]) }\n` +
      `})`
    )
  }
  return (
    head +
    `  setup(props) { return () => h('i', { class: ${JSON.stringify(m.useId)}, style: { fontSize: props.size, color: props.color } }) }\n` +
    `})`
  )
}

/** 组件 barrel:具名 const 导出,Rollup 可在语句级摇除未用到的。 */
export function generateBarrel(metas: IconMeta[]): string {
  const lines = [`import { defineComponent, h } from 'vue'`]
  for (const m of metas) lines.push(componentCode(m))
  return lines.join('\n')
}

/** `.d.ts`:声明 `virtual:supericon` 的具名组件导出。 */
export function generateDts(metas: IconMeta[]): string {
  const lines = [
    `// AUTO-GENERATED by vite-plugin-supericon. Do not edit.`,
    `// import 'virtual:supericon/register' once at your app entry to load font css + svg sprite.`,
    `declare module 'virtual:supericon' {`,
    `  import type { DefineComponent } from 'vue'`,
    `  export type SuperIconProps = { size?: string | number; color?: string }`
  ]
  for (const m of metas) lines.push(`  export const ${m.exportName}: DefineComponent<SuperIconProps>`)
  lines.push(`}`)
  lines.push(`declare module 'virtual:supericon/register' {}`)
  return lines.join('\n') + '\n'
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build:node`
Expected: 通过(importMode.ts 尚未被引用,仅验证自身类型)。

- [ ] **Step 3: 用临时脚本验证生成串正确**

Run:
```bash
node --input-type=module -e "
import { toExportName, buildIconMetas, generateBarrel, generateDts } from './dist/importMode.js' 2>/dev/null || true
" 2>/dev/null || echo "skip (importMode 未单独打包;逻辑将在 Task 5 经 demo 端到端验证)"
```
Expected: 该模块不单独打包,跳过;命名/barrel/dts 在 Task 5 经 demo 验证。`toExportName` 用例:`home→IconHome`、`arrow-left→IconArrowLeft`、`gg-add-r→IconGgAddR`、`4k→Icon4k`。

- [ ] **Step 4: 提交**

```bash
git add src/node/importMode.ts
git commit -m "feat(node): add importMode codegen (naming, metas, barrel, dts)"
```

---

### Task 3: `spriteGenerator` 暴露 `getSymbols()`

**Files:**
- Modify: `src/node/spriteGenerator.ts`

**Interfaces:**
- Produces: `createSpriteGenerator(...)` 返回值新增 `getSymbols(): Map<string, string>`(`useId → <symbol> 串`,反映上次 run 去重后的存活集合)。

- [ ] **Step 1: 维护并暴露 symbol map**

在 `createSpriteGenerator` 内、`const cache = ...` 之后加:
```ts
  let lastSymbols = new Map<string, string>()
```
在 `run` 的循环里,确认入选(`seen.add` 之后)处填充——即把现有:
```ts
          seen.add(entry.item.useId)
          symbols.push(entry.symbol)
          data.push(entry.item)
```
改为:
```ts
          seen.add(entry.item.useId)
          symbols.push(entry.symbol)
          data.push(entry.item)
          nextSymbols.set(entry.item.useId, entry.symbol)
```
并在循环**前**加 `const nextSymbols = new Map<string, string>()`,循环**后**(写文件前后均可)加 `lastSymbols = nextSymbols`。

在 `return { run }` 改为:
```ts
  return { run, getSymbols: () => lastSymbols }
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build:node`
Expected: 通过。

- [ ] **Step 3: 提交**

```bash
git add src/node/spriteGenerator.ts
git commit -m "feat(node): expose spriteGenerator.getSymbols() for build-time pruning"
```

---

### Task 4: `index.ts` 编排(mode 分流 / register / dts / build 裁剪 / watch)

**Files:**
- Modify: `src/node/index.ts`

**Interfaces:**
- Consumes: `buildIconMetas`/`generateBarrel`/`generateDts` (Task 2)、`spriteGenerator.getSymbols()` (Task 3)、`mode`/`dts`/register 常量 (Task 1)、现有 `SPRITE_INJECT_HELPER`、`fontsGenerator`/`spriteGenerator`。

- [ ] **Step 1: 引入依赖与解构 `mode`/`dts`**

`index.ts` 顶部 import 增加:
```ts
import { writeFileSync, readFileSync } from 'node:fs' // 已有 writeFileSync/readFileSync 则复用,勿重复
import { buildIconMetas, generateBarrel, generateDts } from './importMode'
import {
  VIRTUAL_REGISTER_ID,
  RESOLVED_VIRTUAL_REGISTER_ID,
  DEFAULT_DTS
} from './constants'
```
> 注:`writeFileSync`/`readFileSync` 现有 import 已包含,合并到现有 `from 'node:fs'` 行,不要新增重复 import。

在 `superIcon` 顶部解构追加 `mode` 与 `dts`:
```ts
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    prefix = 'icon',
    font: _font,
    svg,
    srcDir: _legacySrcDir,
    name: _legacyName,
    mode = 'class',
    dts = DEFAULT_DTS
  } = options || {}
```

- [ ] **Step 2: 插件闭包内加 import 模式状态与辅助**

在 `superIcon` 内(`const spriteName = ...` 附近)加:
```ts
  const isImport = mode === 'import'
  let spriteRef: string | undefined // build 期 emitFile 资产引用 id

  // 构建 metas + 冲突报错;并(按需)写 .d.ts。dev/build 都会调。
  async function buildMetasOrThrow(): Promise<ReturnType<typeof buildIconMetas>['metas']> {
    const [fontList, svgList] = await Promise.all([
      fontsGenerator?.run() ?? Promise.resolve([] as IconData),
      spriteGenerator?.run() ?? Promise.resolve([] as IconData)
    ])
    const { metas, conflicts } = buildIconMetas([...fontList, ...svgList])
    if (conflicts.length) {
      const msg = conflicts
        .map((c) =>
          c.reason === 'duplicate'
            ? `导出名冲突 "${c.exportName}":${c.paths.join(' ↔ ')}(import 模式下图标名须跨目录全局唯一)`
            : `非法图标名(无法生成标识符):${c.paths.join(', ')}`
        )
        .join('\n')
      throw new Error(`[${NAME}] import 模式命名冲突:\n${msg}`)
    }
    if (dts !== false) {
      writeFileSync(resolve(root, dts), generateDts(metas))
    }
    return metas
  }
```

- [ ] **Step 3: `resolveId` 支持 register(import 模式)**

把 `resolveId` 改为:
```ts
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
      if (id === VIRTUAL_FONT_CSS_ID) return RESOLVED_VIRTUAL_FONT_CSS_ID
      if (isImport && id === VIRTUAL_REGISTER_ID) return RESOLVED_VIRTUAL_REGISTER_ID
    },
```

- [ ] **Step 4: `load` 按 mode 分流**

把现有 `async load(id)` 整体替换为:
```ts
    async load(id) {
      // 内部嵌套:font CSS(class/import 共用)
      if (id === RESOLVED_VIRTUAL_FONT_CSS_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }

      // ── import 模式 ──
      if (isImport) {
        // 组件 barrel:可摇除
        if (id === RESOLVED_VIRTUAL_MODULE_ID) {
          const metas = await buildMetasOrThrow()
          return { code: generateBarrel(metas), moduleSideEffects: false }
        }
        // register:副作用初始化(加载 font.css + svg sprite)
        if (id === RESOLVED_VIRTUAL_REGISTER_ID) {
          await Promise.all([fontsGenerator?.run(), spriteGenerator?.run()])
          const lines: string[] = []
          if (fontsGenerator) lines.push(`import ${JSON.stringify(VIRTUAL_FONT_CSS_ID)}`)
          if (spriteGenerator) {
            if (isDev) {
              const spriteUrl = `/@fs/${distDir}/${spriteName}.svg`
              lines.push(
                `${SPRITE_INJECT_HELPER}\n` +
                  `fetch(${JSON.stringify(spriteUrl)}).then(function(r){return r.text()}).then(__supericonInject)`
              )
            } else {
              // build:emit 占位资产,内容在 generateBundle 裁剪后填入
              spriteRef = this.emitFile({ type: 'asset', name: `${spriteName}.svg` })
              lines.push(
                `${SPRITE_INJECT_HELPER}\n` +
                  `fetch(import.meta.ROLLUP_FILE_URL_${spriteRef}).then(function(r){return r.text()}).then(__supericonInject)`
              )
            }
          }
          return lines.join('\n')
        }
        return
      }

      // ── class 模式(现状,保持不变)──
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
    },
```

- [ ] **Step 5: 加 `generateBundle` 做 build 期 sprite 裁剪**

在插件返回对象里(`load` 之后)加:
```ts
    generateBundle(_outputOptions, bundle) {
      if (!isImport || !spriteGenerator || spriteRef == null) return
      const symbols = spriteGenerator.getSymbols()
      const used = new Set<string>()
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        for (const useId of symbols.keys()) {
          if (file.code.includes('#' + useId)) used.add(useId)
        }
      }
      const body = [...used].map((id) => symbols.get(id) ?? '').join('')
      const sprite =
        `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
        `style="position:absolute;width:0;height:0;overflow:hidden">` +
        body +
        `</svg>`
      this.setAssetSource(spriteRef, sprite)
    },
```

- [ ] **Step 6: dev watch —— import 模式刷新 barrel + dts + full-reload**

在 `configureServer` 的 `if (watch) { ... }` 块里,把 `onChange` 改为:
```ts
      const onChange = () => {
        regenerate(true)
        if (isImport) {
          // 重建 metas(刷新 .d.ts;命名冲突会抛错到终端),并让虚拟模块失效 + 整页刷新
          buildMetasOrThrow().catch((err) => console.error(c.red(err?.message || err)))
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }
```

- [ ] **Step 7: 构建类型检查**

Run: `pnpm build:node`
Expected: 通过,`dist/index.js` + `dist/index.d.ts` 生成。

- [ ] **Step 8: 提交**

```bash
git add src/node/index.ts
git commit -m "feat(node): wire import mode (barrel/register/load split, build sprite prune, dts, watch)"
```

---

### Task 5: demo import 模式示例 + 端到端验证

**Files:**
- Create: `demo/src/import-demo.ts`(import 模式自检入口,临时;验证后保留为示例)
- Modify: `demo/vite.config.ts`(临时切 `mode:'import'` 验证,验证后还原为 class)

**Interfaces:**
- Consumes: 全链路(Task 1–4)。

- [ ] **Step 1: dev 全量验证**

临时改 `demo/vite.config.ts` 的 superIcon 配置为:
```ts
      superIcon({
        font: { dir: './src/assets/icons', name: 'my-icons' },
        svg: { dir: './src/assets/svgicons' },
        mode: 'import'
      })
```
Run: `pnpm build:node && pnpm demo:dev` (起 dev server 后 Ctrl-C 即可;或下一步直接验 build)
Expected: dev 启动无报错;项目根生成 `demo/supericon.d.ts`(因 dts 相对 demo 的 cwd)。
> dev 跑通后停掉。

- [ ] **Step 2: 写一个只 import 部分图标的入口**

`demo/src/import-demo.ts`:
```ts
import 'virtual:supericon/register'
import { IconHeart, IconBox } from 'virtual:supericon'
// 仅 import 这两个;其余图标应在 build 时被裁剪
export const used = [IconHeart, IconBox]
```
在 `demo/index.html` 或 `demo/src/main.ts` 里临时 `import './import-demo'`(确保进 build 模块图)。最简:在 `demo/src/main.ts` 顶部加 `import './import-demo'`。

- [ ] **Step 3: build 验证组件 DCE + sprite 裁剪**

Run: `pnpm demo:build`
Expected: 构建成功;终端无命名冲突报错。

- [ ] **Step 4: 断言产物**

Run:
```bash
echo "=== 组件 DCE:只应保留 IconHeart/IconBox,不应出现未 import 的 IconStar ==="
grep -rl "IconHeart" demo/dist/assets/*.js >/dev/null && echo "IconHeart kept: yes"
grep -rq "IconStar" demo/dist/assets/*.js && echo "IconStar present: YES (unexpected)" || echo "IconStar shaken out: yes"
echo "=== sprite 资产:只应含 icon-heart / icon-box 的 symbol ==="
SPRITE=$(ls demo/dist/assets/sprite*.svg 2>/dev/null | head -1); echo "sprite: $SPRITE"
node -e "const fs=require('fs');const f=process.argv[1];if(!f){console.log('no sprite asset');process.exit(0)}const s=fs.readFileSync(f,'utf8');const ids=[...s.matchAll(/id=\"(icon-[^\"]+)\"/g)].map(m=>m[1]);console.log('symbol ids in pruned sprite:', ids.filter(x=>!x.includes('__')));" "$SPRITE"
```
Expected:
- `IconHeart kept: yes`、`IconStar shaken out: yes`(未 import 的组件被 DCE)。
- 裁剪 sprite 的 symbol id 只含 `icon-heart`、`icon-box`(`icon-star`、`icon-multi-heart` 等未 import 的不在内)。

- [ ] **Step 5: 命名冲突验证**

```bash
# 在 font.dir 与 svg.dir 各放一个同名 home.svg,触发跨目录冲突
printf '<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>' > demo/src/assets/icons/clash.svg
printf '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12"/></svg>' > demo/src/assets/svgicons/clash.svg
pnpm demo:build 2>&1 | grep -i "命名冲突\|conflict\|clash" || echo "(no conflict reported — unexpected)"
rm -f demo/src/assets/icons/clash.svg demo/src/assets/svgicons/clash.svg
```
Expected: 构建报错并指出 `IconClash` 冲突的两个路径。

- [ ] **Step 6: 还原 demo 为 class 模式并回归**

把 `demo/vite.config.ts` 的 `mode: 'import'` 删除(还原 class),并删掉 `demo/src/main.ts` 里临时的 `import './import-demo'`、删除 `demo/src/import-demo.ts`、删除生成的 `demo/supericon.d.ts`。
Run: `pnpm demo:build`
Expected: class 模式构建成功,行为同改动前(sprite.svg 全量、font 正常)。

- [ ] **Step 7: 提交**

```bash
git add src/node demo
git commit -m "test(demo): verify import mode (component DCE + sprite prune + naming conflict)"
```

---

## Self-Review 备忘(已核对)

- **Spec 覆盖**:`mode`(T1)、`.d.ts`(T2 generateDts + T4 写出)、barrel/register/font.css 三模块(T4 load)、组件 font/svg+props(T2 componentCode)、命名/唯一性(T2 buildIconMetas + T4 抛错)、dev 全量(T4 load 不裁剪)、build 组件 DCE(moduleSideEffects:false)+ sprite 裁剪(T4 generateBundle + T3 getSymbols)、watch 刷新(T4 Step6)、footgun 注释(T2 dts 头注释)。
- **占位符**:无 TBD;每步给完整代码/命令与期望。
- **类型一致性**:`buildIconMetas`/`generateBarrel`/`generateDts`/`IconMeta`/`getSymbols()`/`spriteRef`/`buildMetasOrThrow()` 跨任务一致。
- **风险点**:`this.emitFile`/`setAssetSource`/`ROLLUP_FILE_URL_` 依赖 Rollup build 上下文(dev 不走此路径);`load`/`generateBundle` 须为普通方法(现状即对象方法,`this`=PluginContext);used-id 扫描按 `'#'+useId` 子串匹配,误报最坏多留一个 symbol、无正确性问题;dev `dts` 相对 `process.cwd()`(demo 构建时为 demo 目录)。
