# SVG → iconfont 渲染修复 lab

把某些 SVG 转成 iconfont 后“镂空消失 / 整块被填满”的问题,定位、复现、修复并验证。

## 结论(TL;DR)

- **根因**:字体字形(TTF/OTF/WOFF)只用 **non-zero(非零环绕)** 规则填充,并且**完全忽略 SVG 的 `fill-rule`**。
  `@twbs/fantasticon` 内部的 `svgicons2svgfont@12` 把各路径几何**原样拼接**,不读 `fill-rule`、不修正环绕方向
  (源码里搜不到任何 `fill-rule / evenodd / winding / reverse / reorient`)。
  于是用 `fill-rule="evenodd"`(或内外轮廓**同向**)画出来的镂空,在字体里会被填实。
  上游 issue 佐证:[svgicons2svgfont#62](https://github.com/nfroidure/svgicons2svgfont/issues/62)、
  [fantasticon#135](https://github.com/tancredi/fantasticon/issues/135)。

- **修复方法(本仓库交付物 `repair-svg.js`)**:对每条路径,按它**各自的 `fill-rule`** 把轮廓“**纠正方向**”
  (洞的环绕方向与外轮廓相反),再把所有轮廓**合并进一条 path**。等价于 FontForge 的 *Correct Direction* /
  Figma 的 *Flatten* / Illustrator 的 *Compound Path*。输出是一条 **non-zero 正确**、不带 `fill-rule` 的单路径。

- **验证**:用真实的 `fantasticon` 流水线(`svgicons2svgfont → svg2ttf → woff`)分别对**原始**与**修复后**的
  SVG 生成字体,在 Chrome 里逐像素对比。修复后所有图标与源 SVG 渲染一致。

## 真实流水线对比数据(bbox 归一后,像素不一致率 %)

噪声地板 ≈ 1.5–2.5%(来自字体 hinting 与 SVG 抗锯齿差异;control 甜甜圈即 2.45/2.46)。

| icon | 原始→字体 vs 源 | 修复→字体 vs 源 |
|---|---|---|
| flask(示例 1) | **19.21** 🔴 | **4.01** ✅ |
| window(示例 2) | **5.58** 🔴 | **2.68** ✅ |
| donut-hard(同向环绕) | **28.35** 🔴 | **2.46** ✅ |
| two-holes(两个洞) | **39.48** 🔴 | **1.42** ✅ |
| donut(对照,本就安全) | 2.45 | 2.46 |
| overlap(两独立圆相交) | 1.43 | 1.36 |
| nested-fill(同色嵌套) | 1.79 | 1.80 |

4 个真正坏掉的图标全部回落到噪声地板;3 个本就正常的无回归。

## 为什么是“纠正方向 + 合并”,而不是布尔并集

lab 里对 5 种策略做了量化对比(`LAB.compareStrategies()`):

- `union`(paper 布尔并集):单路径图标是 no-op(window/two-holes 修不了),且并集会引入几何误差。
- `reorient`(整体当 evenodd):对“**同色实心块完全包含另一同色实心块**”会误判成洞。
- **`normalize+concat`(交付方案)**:对每条路径按自身 `fill-rule` 纠正方向后拼接,7 个用例全部命中噪声地板,
  且在真实 fantasticon 流水线里无任何反例。

## 文件

| 文件 | 作用 |
|---|---|
| `repair-svg.js` | **交付物**。`createSvgRepairer(paper)` → `{ repairSvg, repairToPathData }`。浏览器 / Node 通用。 |
| `index.html` | 验证台:源 SVG vs 朴素字体(复现 bug)vs 修复字体,逐像素 diff。`LAB.compareStrategies()` / `LAB.fontFaceDiff()`。 |
| `icons.js` | 测试图标(含两个原始示例 + 5 个边界用例)。 |
| `fantasticon-test/build-fonts.mjs` | 跑**真实** fantasticon,生成 `compare.html` 与 woff。 |
| `vendor/` | 本地 vendored 的 `paper.js` / `opentype.js`。 |

## 复现

```bash
# 1) 浏览器验证台(逐像素 diff)
open svg-font-repair-lab/index.html        # 控制台:LAB.compareStrategies()

# 2) 真实 fantasticon 流水线对比
cd svg-font-repair-lab/fantasticon-test && node build-fonts.mjs
open compare.html
```

## 接入 `vite-plugin-supericon`

插件跑在 Node,需要一个无 canvas 的 paper(已验证 `paper-jsdom` 输出与浏览器**逐字节一致**)。
在 `fontsGenerator.ts` 把 SVG 喂给 fantasticon **之前**先修复:

```ts
import paper from 'paper-jsdom'                       // 需新增依赖
import { createSvgRepairer } from './repair-svg'      // 把 repair-svg.js 移到 src/node 并加类型
const { repairSvg } = createSvgRepairer(paper)

// 读 srcDir 下每个 .svg → repairSvg(content) → 写入临时目录 cacheDir
// 然后 generateFonts({ inputDir: cacheDir, ... })
```

> 依赖权衡:`paper-jsdom` 会带入 `jsdom`(体积偏大,且包已 archived 但可用)。
> 若想更轻量,可只在“检测到 `fill-rule="evenodd"` 或多 path / 同向洞”的图标上才修复,其余直通。

## 已知边界

- **描边类图标**(`stroke=`、无 `fill`):字体只认填充,描边会整体消失。需先“描边转轮廓”(stroke→outline)。
  本模块(`repair-svg.js`)只处理**填充环绕方向**;描边轮廓化已单独实现,见
  [`STROKE-TO-FILL.md`](./STROKE-TO-FILL.md)(`stroke-to-fill.js`,光栅化 + potrace 描摹,纯浏览器)。
- `opentype.js` 自建字体对“同色完全嵌套实心块”会留一条接缝;但**真实的 svg2ttf 流水线无此问题**(已验证)。
