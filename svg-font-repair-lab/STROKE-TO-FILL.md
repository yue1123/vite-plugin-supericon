# 描边转填充(stroke → fill)

把 `stroke=`、`fill="none"` 的描边图标(Lucide / Feather 风格)转成**填充**图标,这样才能进字体——字体字形只认填充,描边会整体消失(见 [README](./README.md) 的"已知边界")。

> **现状(client 采用):** `src/client/utils/svg/repair.ts` 的描边分支用 **maker.js**(`expandPaths` 路径偏移)做 stroke→fill,paper 负责解析/放置/环绕/CTM。maker 是 **Apache-2.0**(对 MIT 干净),输出**平滑(真实圆弧)、体积小、单一干净轮廓**。lab 里另外两种方法(potrace 描摹、paper 几何)作为探索/对比保留。

## 三种方法对比

| | 描摹法 potrace | 几何法 paper | **maker.js ← client 采用** |
|---|---|---|---|
| 思路 | 高分辨率栅格化 → potrace 描矢量 | 局部拼"线段矩形+拐角+端帽",乘 CTM | `expandPaths` 把路径偏移成轮廓(真实直线+圆弧) |
| 许可证 | ❌ GPL(不能进 MIT 包) | ✅ MIT(paper) | ✅ Apache-2.0 |
| 输出体积(square-x) | 1.7KB | **13KB**(142 个重叠块) | **~1KB**(单轮廓) |
| 平滑(高倍放大) | ✅ | 重叠块接缝有毛刺 | ✅ 真实圆弧 |
| 依赖 | vendored 33KB(GPL) | 0 新增 | + makerjs ~200–300KB |
| 实现 | `stroke-to-fill.js` | `stroke-to-fill-paper.js` | `src/client/utils/svg/strokeToFill.ts` |

几何法虽精确(均值 0.04%)但输出是大量重叠子路径,外部工具渲染重叠处有毛刺、体积大;maker 给出干净单轮廓(真实圆弧),体积小一个数量级,故 client 选 maker。

## maker 管线(client `strokeToFill.ts`)

`createMakerStroke(paper, maker)`:
1. **`DOMParser` 解析**:逐个可绘制元素算出级联后的描边属性(width/cap/join…)、CTM(组合 transform 属性 → paper.Matrix)、**保弧的局部 `d`**(rect/circle/ellipse → 弧路径;这样 maker 保住真实圆弧,而不是被 paper 拍成贝塞尔后崩掉)。
2. **maker `expandPaths`**:按 (CTM, 线宽, join) 分组,每组整体偏移成填充轮廓(线→平行线、弧→同心弧)。
3. **paper 放置/环绕/帽子/CTM**:maker 输出会重定原点,用"轮廓中心 = 中线中心"对齐放回;多轮廓 `reorient(false,true)` 修正孔洞;开放端点补帽(round=圆盘 / square=方块,作为同向 CW 轮廓靠 non-zero 合并);整体乘 CTM。
4. 输出 0 原点单 `<path fill>`,non-zero;纯填充图标走原 `repair.ts` 的 reorient+concat(无损)。maker 懒加载失败时**回退几何法**。

## 验证(真实 client `repairSvg`,maker 经 Vite 打包,512px 逐像素)

| 用例 | 像素差 | 用例 | 像素差 |
|---|---|---|---|
| square-x(用户) | 0.318% | circle ring | 0.097% |
| rotated rect | 0.019% | star | 0.974% |
| skew | 0.02% | caps butt/round/square | 2.171% |

全部 ≤ 噪声地板(~1.5–2.5%);圆/椭圆、rotate/非均匀/skew、嵌套 group+继承、混合 fill+stroke 均正确;高倍放大圆角平滑无毛刺。

## ⚠️ 已知问题(待后续仔细琢磨)

- **line 的 `round` 端帽无法完美转换**:开放路径的圆头帽目前是"在端点叠加一个 radius=半线宽 的圆盘、靠 non-zero 合并"。这对直线圆头帽(`caps` 用例 2.17%、是所有用例里最高的)有微小的边缘偏差——帽的圆弧与胶囊端的接合不是像素级完美。**先放着,优先完成其他功能,后面再细究**(可能的方向:让 maker 原生出圆头帽,或精确构造半圆帽与胶囊端相切的单一轮廓)。
- `stroke-dasharray` / `vector-effect="non-scaling-stroke"` 不处理;百分比/单位尺寸按用户单位截取;`<defs>/<clipPath>/<mask>` 内描边也会被转;渐变/图案描边压平为 `currentColor`(单色字体场景所需)。

## 文件

| 文件 | 作用 |
|---|---|
| `src/client/utils/svg/strokeToFill.ts` | **client 交付物**。`createMakerStroke(paper, maker) → { toPathData, toSvg }`。 |
| `src/client/utils/svg/repair.ts` | 描边走 maker(懒加载),几何法兜底;填充走 reorient+concat。 |
| `stroke-to-fill-paper.js` | 几何法(lab 探索/兜底参考)。 |
| `stroke-to-fill.js` + `vendor/potrace.js` | 描摹法(potrace,**GPL**,仅 lab 对比,不进 npm 包)。 |
| `stroke-fix-paper.html` / `stroke-icons.js` | 对比验证台 / 18 个测试图标。 |
