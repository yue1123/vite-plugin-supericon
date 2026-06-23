# Supericon 预览页 — 设计与主题实现 Spec

> 适用文件:`Supericon Preview · 薄荷绿.dc.html`
> 用途:`vite-plugin-supericon` 的 dev server 预览页。读取指定目录的 SVG → 生成 iconfont,并提供搜索、布局调整、图标列表、详情对比/编辑、绘制规则帮助等功能。
> 本文同时给出从原型迁移到生产(Vue 3 + Naive UI)的主题落地方案。

---

## 1. 概览

| 项 | 说明 |
|---|---|
| 形态 | 单页应用,居中布局,最大宽度 `1240px` |
| 两套视觉风格 | **Vite**(青绿→薄荷渐变)/ **Mono**(纯 #63e2b7) |
| 两套明暗 | dark / light,运行时切换 |
| 主题色 | `#63e2b7`(深色态主强调) / `#18a058`(浅色态加深以保证白底对比度) |
| 页面 | ① 图标库(列表)② 使用帮助(草图风) |
| 详情 | 弹窗(Modal)形式,不跳页 |

---

## 2. 功能清单

### 2.1 图标库(列表页)
- **搜索**:按名称 / 别名 / id / 分组实时过滤;`⌘K` / `Ctrl+K` 聚焦。
- **分组筛选**:All + 7 个分组(Navigation / System / People / Action / Communication / Layout / Media),chip 上显示数量。
- **问题筛选**:一键只看「重复 / 同名冲突」图标,显示问题计数。
- **排序**:名称 / 修改时间,升降序切换(方向提示随字段变化:名称 `A→Z / Z→A`,时间 `最新 / 最旧在前`)。
- **布局调整**:
  - 图标尺寸:预设 `S(24) / M(32) / L(48) / XL(64)`(非无极滑块)。
  - 网格密度(列数):`紧凑(10) / 适中(8) / 舒适(6)`。
  - 名称显隐切换。
- **卡片**:悬停浮现「复制代码 / 复制 id」;重复与同名冲突角标提示。
- **空态**:无匹配时提示 + 一键清除筛选。

### 2.2 图标详情(弹窗)
- **SVG vs Font 对比**,三种模式:
  - 并排(side):左源 SVG / 右 Font 字形。
  - 叠加(overlay):两者叠放 + Font 透明度滑块。
  - 分割(split):可拖动分割线左右对比。
  - 背景切换:棋盘格 / 深底 / 浅底;预览尺寸预设 `48 / 96 / 160 / 240`。
- **编辑**:逆/顺时针旋转 90°、水平/垂直翻转;「复位 / 保存修改 / 另存为新图标」。
  - 保存修改:把变换烘焙进 SVG(`<g transform>`)并盖修改时间戳。
  - 另存为新图标:基于当前(含变换)状态,自动分配新 id / unicode / 路径,追加进库。
- **元信息**:源路径、id、unicode(U+/转义)、别名、viewBox、原始尺寸、路径节点数+类型、文件体积、修改时间、哈希。可逐项复制。
- **重命名**:`icon-` 前缀输入,改名提示会更新 id / unicode 映射 / 引用。
- **使用代码**:HTML / React / Vue / CSS 片段,一键复制。

### 2.3 使用帮助页(草图手绘风)
- Hero:手写体标题(Caveat)+ 波浪下划线,`feTurbulence` 抖动滤镜营造铅笔质感。
- ① 三步接入:放入 SVG → 配置插件 → 启动使用,每步配草图插画 + 代码。
- ② 6 条绘制规则:统一画布网格 / 安全边距 / 用填充而非描边 / 合并单一路径 / 单色清理属性 / kebab-case 命名,每条配手绘示意 + ✓/✗ 对照。

---

## 3. 主题系统(核心)

### 3.1 设计原则
1. **单一 token 源**:所有颜色/圆角/阴影集中定义一次,组件库与自定义 CSS 共用,改一处全局生效。
2. **划清边界**:成品组件库只负责「难写的行为」(Dialog / Popover / Tooltip / Message / Slider / Tabs / Input),产品招牌视觉(图标卡片、Header 玻璃、对比 stage)保持纯自定义,不套库。
3. **明暗 + 风格正交**:`style ∈ {vite, mono}` × `mode ∈ {dark, light}`,共 4 套 token 串。

### 3.2 Token 全集(以 CSS 变量形式下发)

当前原型把 4 套 token 写成 CSS 变量串挂在根元素 `style` 上。语义如下:

| Token | 含义 |
|---|---|
| `--bg` / `--bg2` | 页面底色 / 抬升表面(header、aside) |
| `--panel` / `--panel2` | 卡片/面板底 / 次级面板底(分段控件轨道) |
| `--border` / `--border2` | 主描边 / 强描边(hover) |
| `--text` / `--text2` / `--text3` | 主文字 / 次级 / 占位与弱化(**中性灰,不带主题色调**) |
| `--accent` / `--accent2` | 主强调 / 辅助强调 |
| `--accent-soft` | 强调色低透明填充(soft 背景、焦点环) |
| `--on-accent` | 强调底上的文字色 |
| `--grad` | 品牌渐变(Vite)/ 纯色(Mono) |
| `--warn` / `--warn-soft` | 警示色(重复/冲突)/ 其低透明填充 |
| `--sh1` / `--sh2` / `--sh3` | 静息柔影 / 悬停浮起影 / 弹窗大投影 |
| `--glass` | Header 半透明玻璃底(配 `backdrop-filter`) |
| `--hairline` | 发丝分隔线 |
| `--inset` | 内高光(玻璃/选中态顶部高光) |

#### 真实取值(供生产 token 文件直接抄)

**Vite · dark**
```
--bg:#080b0a; --bg2:#0c100e; --panel:#121815; --panel2:#19211d;
--border:rgba(255,255,255,.08); --border2:rgba(255,255,255,.16);
--text:#f1f3f4; --text2:#9ba0a3; --text3:#61666a;
--accent:#63e2b7; --accent2:#36d399; --accent-soft:rgba(99,226,183,.16); --on-accent:#04231a;
--grad:linear-gradient(120deg,#36d399,#63e2b7);
--warn:#ffb224; --warn-soft:rgba(255,178,36,.13);
--sh1:0 1px 2px rgba(0,0,0,.4);
--sh2:0 10px 30px -8px rgba(0,0,0,.62),0 2px 8px -3px rgba(0,0,0,.5);
--sh3:0 36px 80px -20px rgba(0,0,0,.78);
--glass:color-mix(in srgb,#0c100e 70%,transparent);
--hairline:rgba(255,255,255,.06); --inset:inset 0 1px 0 rgba(255,255,255,.05);
```

**Vite · light**
```
--bg:#f5f7f7; --bg2:#ffffff; --panel:#ffffff; --panel2:#f0f3f3;
--border:#e8ebeb; --border2:#d8dcdc;
--text:#1a1c1d; --text2:#5b6063; --text3:#9499a0;
--accent:#18a058; --accent2:#36ad6a; --accent-soft:rgba(24,160,88,.10); --on-accent:#fff;
--grad:linear-gradient(120deg,#18a058,#63e2b7);
--warn:#b45309; --warn-soft:rgba(180,83,9,.09);
--sh1:0 1px 2px rgba(17,24,21,.05);
--sh2:0 12px 32px -10px rgba(17,24,21,.13),0 3px 10px -4px rgba(17,24,21,.07);
--sh3:0 30px 70px -16px rgba(17,24,21,.22);
--glass:color-mix(in srgb,#ffffff 68%,transparent);
--hairline:rgba(17,24,21,.05); --inset:inset 0 1px 0 rgba(255,255,255,.6);
```

**Mono · dark**(与 Vite·dark 同结构,差异处)
```
--bg:#090c0b; --bg2:#0d1110; --panel:#131816; --panel2:#1a201d;
--border:rgba(255,255,255,.07); --border2:rgba(255,255,255,.15);
--text:#f0f2f3; --text2:#989da1; --text3:#5d6266;
--accent:#63e2b7; --accent2:#7eebc9; --accent-soft:rgba(99,226,183,.15); --on-accent:#04231a;
--grad:#63e2b7;  --warn:#f5a524; --warn-soft:rgba(245,165,36,.13);
--glass:color-mix(in srgb,#0d1110 70%,transparent);
--hairline:rgba(255,255,255,.055); --inset:inset 0 1px 0 rgba(255,255,255,.045);
（--sh1/2/3 同 Vite·dark）
```

**Mono · light**(差异处)
```
--accent:#18a058; --accent2:#2bb46c; --accent-soft:rgba(24,160,88,.09);
--grad:#18a058;  （其余同 Vite·light）
```

### 3.3 数值常量
```js
SIZE_PRESETS   = [S:24, M:32, L:48, XL:64]   // 图标尺寸
DENSITY_PRESETS= [紧凑:10, 适中:8, 舒适:6]    // 网格列数
DETAIL_PRESETS = [48, 96, 160, 240]          // 详情预览尺寸
SORT_PRESETS   = [名称:'name', 时间:'mtime']
```
圆角:卡片 `14px` / 弹窗 `20px` / popover `13px` / 分段控件 `7-9px`。
过渡曲线统一 `cubic-bezier(.2,.7,.3,1)`。

### 3.4 质感规范(精修要点)
- **景深**:卡片静息 `--sh1`;悬停 `translateY(-3px)` + `--sh2` + 强调色细环 `0 0 0 1px var(--accent-soft)`,且图标本体 `scale(1.14)` 平滑放大。
- **Header 玻璃**:`background:var(--glass)` + `backdrop-filter:blur(16px) saturate(1.7)` + `--sh1`。
- **选中态**:分组激活带同色辉光 `0 5px 14px -4px color-mix(in srgb,var(--accent) 55%,transparent)`;分段控件选中项 `--sh1, --inset`。
- **文字中性化**:`--text*` 一律中性灰,不掺主题绿,避免「文字贴合主题色」的廉价感。

> ⚠️ **已知坑(必须遵守)**:图标卡片**不要用 `transition: .15s`(等价 `transition: all`)**。在 `var()` 主题切换时,Chromium 会让 `background-color` 的过渡卡死、停在旧主题色。务必限定为 `transition: border-color .16s, box-shadow .18s, transform .16s ...`,让背景随主题瞬时切换。

---

## 4. 生产落地:Vue 3 + Naive UI 的主题桥接

> 结论:**Vue 用 Naive UI(主题色天然契合、组件完整、可扛大列表);React 或追求极致定制用 Headless UI。** 下方按 Naive 方案给出可维护架构。

### 4.1 唯一真相源
```ts
// tokens.ts —— 所有 token 集中于此,深浅两套
export const themes = {
  light: { accent:'#18a058', accentHover:'#36ad6a', accentPressed:'#148a4b',
           card:'#ffffff', panel2:'#f0f3f3', border:'#e8ebeb', border2:'#d8dcdc',
           text:'#1a1c1d', text2:'#5b6063', text3:'#9499a0', radius:'14px', radiusSm:'8px',
           sh1:'0 1px 2px rgba(17,24,21,.05)',
           glass:'color-mix(in srgb,#ffffff 68%,transparent)' },
  dark:  { accent:'#63e2b7', accentHover:'#7fe9c5', accentPressed:'#48c9a0',
           card:'#131816', panel2:'#1a201d', border:'rgba(255,255,255,.08)', border2:'rgba(255,255,255,.16)',
           text:'#f1f3f4', text2:'#9ba0a3', text3:'#61666a', radius:'14px', radiusSm:'8px',
           sh1:'0 1px 2px rgba(0,0,0,.4)',
           glass:'color-mix(in srgb,#0d1110 70%,transparent)' },
}
```

### 4.2 单源 → 两出口
```ts
// naive-theme.ts —— token 映射成 Naive 的 themeOverrides
import type { GlobalThemeOverrides } from 'naive-ui'
export const buildNaiveOverrides = (t): GlobalThemeOverrides => ({
  common: {
    primaryColor: t.accent, primaryColorHover: t.accentHover, primaryColorPressed: t.accentPressed,
    borderRadius: t.radius, borderRadiusSmall: t.radiusSm,
    textColorBase: t.text, borderColor: t.border, cardColor: t.card, popoverColor: t.card,
  },
  Button:  { borderRadiusMedium: t.radiusSm, fontWeightStrong: '600' },
  Card:    { borderRadius: t.radius },
  Input:   { borderRadius: t.radiusSm, heightMedium: '42px' },
  Popover: { borderRadius: t.radiusSm, padding: '12px' },
  Tooltip: { borderRadius: t.radiusSm },
  Slider:  { fillColor: t.accent, fillColorHover: t.accentHover },
})
```

```vue
<!-- App.vue —— 一个 provider 同时驱动 Naive 与 CSS 变量 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { darkTheme } from 'naive-ui'
import { themes } from './tokens'
import { buildNaiveOverrides } from './naive-theme'

const dark = ref(false)
const t = computed(() => dark.value ? themes.dark : themes.light)
const naiveOverrides = computed(() => buildNaiveOverrides(t.value))            // 出口① 给 Naive
const cssVars = computed(() =>                                                 // 出口② 给 CSS
  Object.fromEntries(Object.entries(t.value).map(([k, v]) => [`--${k}`, v])))
</script>

<template>
  <n-config-provider :theme="dark ? darkTheme : null" :theme-overrides="naiveOverrides">
    <div class="app-root" :style="cssVars"><!-- 自定义部分照常 var() --></div>
  </n-config-provider>
</template>
```

### 4.3 三层覆盖(按精度递进)
1. `common` 全局 token —— 改一次,整库跟随(覆盖 ~80% 适配)。
2. 组件级 `themeOverrides`(`Card`/`Input`/…)—— 文档化变量,**类型安全**,精调用这层。
3. 实例级 `:theme-overrides` prop —— 单个实例特例,影响面隔离。

### 4.4 派生色一致性
自定义 CSS 想用 Naive **自动派生**的 hover/pressed/suppl,用 `useThemeVars()` 读出再并进 `cssVars`,确保派生逻辑只算一次。

### 4.5 兜底
个别样式无对应 theme 变量时:先查 peer 组件变量 → `useThemeVars()` 反向对齐 → 最后才用 Vue `:deep()` 定向覆盖单个组件并加注释。**禁止**满地 `!important`。

---

## 5. 组件 → Naive 映射 & 边界

| UI 块 | 实现方式 | 备注 |
|---|---|---|
| 详情弹窗 | `n-modal` | 焦点陷阱/Esc 关闭交给库 |
| 工具栏 popover | `n-popover`(trigger=hover) | |
| 对比模式切换 | `n-tabs` 或自定义分段 | |
| 排序/尺寸/密度/风格 分段 | `n-radio-group`(button 态) | |
| 搜索/重命名输入 | `n-input` | 重命名做前缀 + 校验 |
| 复制成功提示 | `n-message` | |
| 悬停提示 | `n-tooltip` | |
| 叠加透明度 / 分割 | `n-slider` | |
| 复制按钮 / 主按钮 | `n-button` | |
| **图标网格卡片** | **纯自定义** | 招牌视觉:悬停浮起 + 图标放大 + 细环 |
| **Header 玻璃** | **纯自定义** | `backdrop-filter` + `--glass` |
| **SVG/Font 对比 stage** | **纯自定义** | 棋盘格、分割拖动、叠加 |
| **大列表(上百图标)** | `n-virtual-list` 或 @tanstack/virtual | 网格虚拟化保证性能 |

---

## 6. 状态模型(原型实现参考)

```
icons[]      图标数据(含 dupOf/conflict/mtime 等元信息)
style        'vite' | 'mono'
mode         'dark' | 'light'
page         'library' | 'help'
detailId     当前详情图标 idx(null 为关闭)
q            搜索词
group        当前分组(默认 'All')
issuesOnly   仅看问题
size         图标尺寸(预设值)
cols         网格列数(密度预设值)
showNames    名称显隐
sortBy/sortDir  排序字段 / 方向
cmp          'side' | 'overlay' | 'split'
overlay/split/bg/detailSize   对比相关
rot/flipH/flipV  编辑变换
renameVal    重命名输入值
toast        提示文案
```

图标对象关键字段:`id / name / alias / group / svg / path / viewBox / width / height / unicode(+Hex) / glyph / nodes / bytes / mtime / hash / type('solid'|'stroke') / dupOf / conflict / note`。

---

## 7. 实现注意事项

1. **Font 构建语义**:字体为单色填充轮廓。描边类(`type:'stroke'`)图标在字体里会被轮廓化,详情页用「描边已轮廓化」徽标提示需核对粗细;填充类标「像素一致」。
2. **重复/冲突检测**:`dupOf` 指向哈希相同的图标;`conflict` 标记 id 命名冲突。列表角标 + 详情通知双重提示。
3. **重命名/另存**会重算 id、unicode 映射并盖 `mtime`,因此「按时间排序」可直观体现刚编辑/新建的图标浮到最前。
4. **键盘**:`⌘/Ctrl+K` 聚焦搜索;`Esc` 关闭详情弹窗。
5. **性能**:图标量级上百时启用虚拟网格;搜索过滤可加防抖。

---

## 8. 设计资源(Assets)

### 8.1 Logo
| 文件 | 规格 | 用途 |
|---|---|---|
| `supericon-logo.svg` | 48×48,12px 圆角方块,青→紫(`#41d1ff→#bd34fe`)渐变底 + 白色圆角闪电 | app icon / favicon / 文档头部 |
| `supericon-mark.svg` | 24×24,闪电字形,`fill="currentColor"` | 内嵌任意背景,用 CSS `color` 控色 |

> 预览页 header 里的 logo 用的是 mark 路径 + `currentColor`,底色由 `--grad`(Vite 渐变 / Mono 纯色)驱动,随风格自动适配。

### 8.2 字体
| 场景 | 字体 |
|---|---|
| UI 正文 | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`(系统栈) |
| 等宽(路径/id/代码/数值) | `ui-monospace, SFMono-Regular, Menlo, monospace` |
| 帮助页手写标题 | **Caveat**(500/700,Google Fonts) |
| 帮助页草图标注 | **Kalam**(Google Fonts) |

### 8.3 UI 图标集(内联 SVG,24×24,`currentColor`)
统一定义在 `UI` 常量里,均为 stroke 风格(`stroke-width:2` 为主):

`search` 搜索 · `sun`/`moon` 明暗 · `copy` 复制 · `check` 对勾 · `warn` 警示 · `eye`/`eyeoff` 名称显隐 · `empty` 空态 · `close` 关闭 · `rotL`/`rotR` 旋转 · `flipH`/`flipV` 翻转 · `sortArrow` 升降序 · `sortCtrl`/`sizeCtrl`/`colsCtrl` 排序/尺寸/密度触发器 · `caret` 下拉箭头。

### 8.4 草图风滤镜
帮助页插画的铅笔抖动质感由一个 SVG 滤镜实现:
```
<filter id="sk-rough">
  <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="6"/>
  <feDisplacementMap scale="2.6"/>
</filter>
```
所有草图描边/形状套 `filter="url(#sk-rough)"`,配合 `currentColor` 跟随主题。

### 8.5 Mock 图标数据(`icons.js`)
- **35 个基础图标**,分布于 7 个分组;另含 **1 个视觉重复**(`house` 与 `home` 路径完全一致)与 **1 个同名冲突**(`settings`),用于演示重复/冲突检测。
- unicode 从 `0xEA01` 起递增分配。
- 字段:见 §6;`type` 由是否含 `stroke=` 自动判定(影响详情页「像素一致 / 描边已轮廓化」判定)。
- 接真实插件时:替换 `buildIcons()` 的数据来源为插件扫描结果即可,字段对齐后 UI 无需改动。

---

## 9. 帮助页完整内容

### 9.1 Hero
- 手写副标:`✎ supericon · 使用手册`
- 主标题:**把一堆 SVG,收编成一套图标字体**(「收编成」下方带波浪手绘下划线)
- 引导语:把图标 SVG 丢进目录,插件会在 dev / build 时自动生成 iconfont、字符映射与类型提示。

### 9.2 ① 三步接入
| 步骤 | 标题 | 说明 | 代码 |
|---|---|---|---|
| 1 | 放入 SVG | 把图标文件放进指定目录,子文件夹会成为分组 | `src/assets/icons/*.svg` |
| 2 | 配置插件 | 在 vite.config 注册,指定目录与字体名 | `import si from 'vite-plugin-supericon'`<br>`plugins:[ si({ dir:'src/assets/icons' }) ]` |
| 3 | 启动与使用 | 运行 dev 即在预览页查看,按下方式引用 | `<i class="si si-home"></i>` |

### 9.3 ② 画图标的 6 条规则
> 字体是单色、纯轮廓的载体。遵守这几条,SVG 才能干净地转成字形。

| # | 规则 | 要点 | ✓ 推荐 | ✗ 避免 |
|---|---|---|---|---|
| 01 | 统一画布与网格 | 所有图标在同一张 24×24 画布上绘制,对齐像素网格,用 keyline 圆/方做参考框统一视觉重量 | 整数坐标、偶数描边 | 0.5px 半像素错位 |
| 02 | 留出安全边距 | 四周留约 2px 安全区,主体落在 20×20 活动区内 | 主体居中、四周留白 | 图形顶满画布 |
| 03 | 用填充而非描边 | iconfont 字形只认填充轮廓,描边须先「描边转轮廓」 | fill + 闭合路径 | 开放的 stroke 线条 |
| 04 | 合并为单一路径 | 同图标所有形状做布尔并集,合成一条闭合路径,去重叠/镂空错误 | 并集 / 合并路径 | 多块重叠形状 |
| 05 | 单色,清理多余属性 | 移除 fill 颜色、内联 style、id、class,只留路径几何,颜色交给使用处 CSS | 纯路径 + currentColor | 多色 / 渐变 / 内联样式 |
| 06 | kebab-case 命名 | 文件名直接决定图标 id,全小写中划线,语义在前修饰在后 | `chevron-down` | `ChevronDown` / 带空格 / 副本后缀 |

### 9.4 如何「完美复刻」帮助页

帮助页的草图插画是**逐条手绘的内联 SVG**——无法从文字描述还原,只能复制源码。已抽出独立、自包含的参考文件:

> **`help-page.html`** —— 打开即预览(内置 Caveat/Kalam 字体、`#sk-rough` 滤镜、深浅 token 与切换按钮),`<body>` 段落可直接复制到生产。

复刻三要件,缺一不可:

1. **字体**:`<head>` 引入 Caveat(500/700)+ Kalam,否则手写标题/草图标注会退化成系统字体。
2. **草图滤镜**:页面里放一次 `<filter id="sk-rough">`(`feTurbulence baseFrequency=0.018` + `feDisplacementMap scale=2.6`),所有手绘 `<g>`/`<path>` 套 `filter="url(#sk-rough)"` 才有铅笔抖动质感。调 `scale` 改抖动强度、调 `seed` 换抖动纹路。
3. **token 变量**:插画用 `currentColor` + `var(--accent/--accent2/--warn/--panel2/--text3)`,所以挂载处必须能解析这套 CSS 变量(见 §3.2),才能随主题自动变色。

迁移到 Vue/Naive 时:把 `help-page.html` 的 `<body>` 内容整段搬进帮助页组件的 `<template>`,字体引入移到入口,token 变量复用全局那套即可——插画、文案、布局零改动。

> 关键:**6 张草图 + Hero 波浪线 + 三步插画的 SVG path 坐标都是定制值,务必整段复制,不要试图手写还原。**
