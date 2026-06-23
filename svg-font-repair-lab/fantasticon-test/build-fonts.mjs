// End-to-end proof: run the REAL @twbs/fantasticon pipeline (svgicons2svgfont ->
// svg2ttf -> woff) on the ORIGINAL icons vs the REPAIRED icons, and emit a
// compare.html that loads both real fonts next to the source SVGs.
import { generateFonts, FontAssetType, OtherAssetType } from '@twbs/fantasticon'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(here, 'data.json'), 'utf8'))

const dirs = {
  original: join(here, 'src-original'),
  repaired: join(here, 'src-repaired'),
}
for (const [variant, dir] of Object.entries(dirs)) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const ic of data) {
    // svgicons2svgfont needs explicit width/height; mirror what a real plugin feeds it.
    const svg = ic[variant].replace('<svg ', '<svg width="24" height="24" ')
    writeFileSync(join(dir, `${ic.file}.svg`), svg)
  }
}

async function build(variant) {
  const inputDir = dirs[variant]
  const outputDir = join(here, `out-${variant}`)
  rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })
  const result = await generateFonts({
    inputDir,
    outputDir,
    name: `lab-${variant}`,
    fontTypes: [FontAssetType.WOFF2, FontAssetType.WOFF],
    assetTypes: [OtherAssetType.JSON],
    normalize: true,
    fontHeight: 1000,
  })
  // codepoints map: { iconName: codepoint }
  return { variant, outputDir, codepoints: result.codepoints }
}

const orig = await build('original')
const rep = await build('repaired')
console.log('codepoints original:', orig.codepoints)
console.log('codepoints repaired:', rep.codepoints)

// Build compare.html
const rows = data.map((ic) => {
  const cp = orig.codepoints[ic.file] ?? rep.codepoints[ic.file]
  const ch = `&#x${cp.toString(16)};`
  return `<tr>
    <td><div class="name">${ic.name}</div><div class="file">${ic.file}</div></td>
    <td><div class="box src">${ic.original.replace('<svg ', '<svg width="80" height="80" ')}</div><div class="lbl">source SVG</div></td>
    <td><div class="box"><span class="ico orig">${ch}</span></div><div class="lbl">font: ORIGINAL (bug)</div></td>
    <td><div class="box"><span class="ico rep">${ch}</span></div><div class="lbl">font: REPAIRED</div></td>
  </tr>`
}).join('\n')

const woff = (v) => `out-${v}/lab-${v}.woff`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'orig';src:url('${woff('original')}') format('woff');}
@font-face{font-family:'rep';src:url('${woff('repaired')}') format('woff');}
body{background:#0f1115;color:#e6e9ef;font:14px ui-monospace,monospace;padding:24px;}
table{border-collapse:collapse;width:100%;}td{border:1px solid #262b36;padding:12px;text-align:center;vertical-align:top;}
.name{font-weight:700;text-align:left;}.file{color:#8b94a6;font-size:11px;text-align:left;}.lbl{color:#8b94a6;font-size:11px;margin-top:6px;}
.box{width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:6px;margin:0 auto;}
.src svg{color:#111;}.ico{font-size:80px;line-height:80px;color:#111;}
.ico.orig{font-family:'orig';}.ico.rep{font-family:'rep';}
h1{font-size:18px;}</style></head><body>
<h1>Real fantasticon pipeline: source SVG vs ORIGINAL font vs REPAIRED font</h1>
<table><thead><tr><th>icon</th><th>① source</th><th>② original→font</th><th>③ repaired→font</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`

writeFileSync(join(here, 'compare.html'), html)
console.log('wrote', join(here, 'compare.html'))
