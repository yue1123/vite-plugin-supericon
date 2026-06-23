/**
 * SVG → font-safe repair (client utility).
 *
 * Icon fonts fill glyphs with the non-zero winding rule and ignore SVG
 * `fill-rule`. Icons authored with `fill-rule="evenodd"` (or same-winding holes)
 * render with their holes filled solid as a glyph. Fix: reorient each path to be
 * non-zero-correct under its own fill-rule, then merge contours into one path.
 * See docs/product-direction.md §0.
 *
 * paper is dependency-injected so the core stays portable; the browser entry
 * lazy-loads `paper/dist/paper-core` (kept out of the first paint).
 */

import { getViewBox } from './getViewBox'
import { hasStroke } from './stroke'
import { createMakerStroke } from './strokeToFill'

interface MakerStroke { toPathData(svg: string): { d: string } }

export interface SvgRepairer {
  repairToPathData(svg: string): string
  repairSvg(svg: string): string
  analyze(svg: string): { needsRepair: boolean }
}


// `paper` is the injected scope (paper-core). Typed loosely on purpose —
// paper's bundled d.ts fights subpath/dynamic imports.
export function createSvgRepairer(paper: any, makerStroke?: MakerStroke): SvgRepairer {
  if (!paper.project) paper.setup(new paper.Size(1024, 1024))

  

  // paper reads width="1em" as 1 user unit and squashes the viewBox into [0,1].
  // Force width/height to the viewBox size so geometry stays in viewBox units.
  function prepSvg(svg: string): string {
    const vb = getViewBox(svg)
    return expandRects(svg).replace(/<svg\b[^>]*>/, (tag) =>
      tag
        .replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
        .replace('<svg', `<svg width="${vb.w}" height="${vb.h}"`)
    )
  }

  function fillRuleOf(item: any): 'evenodd' | 'nonzero' {
    const fr = item.fillRule || (item.style && item.style.fillRule)
    return fr === 'evenodd' ? 'evenodd' : 'nonzero'
  }

  function collectLeaves(root: any, out: any[] = []): any[] {
    if (!root) return out
    if (root.className === 'Path' || root.className === 'CompoundPath') out.push(root)
    else if (root.children) for (const child of root.children) collectLeaves(child, out)
    return out
  }

  // Make a multi-subpath path non-zero-correct (holes wound opposite their
  // container), interpreting the current geometry under its own fill-rule.
  function normalizeLeaf(item: any): any {
    if (item.className === 'CompoundPath' && item.children.length > 1) {
      item.reorient(fillRuleOf(item) === 'nonzero', true /* outer clockwise */)
    }
    return item
  }

  function strokeWidthOf(item: any): number {
    const w = item.strokeWidth
    return typeof w === 'number' && w > 0 ? w : 1
  }
  const isStroked = (item: any): boolean => !!item.strokeColor && strokeWidthOf(item) > 0
  const hasFillPaint = (item: any): boolean => !!item.fillColor

  // ---- geometric stroke → fill (描边转轮廓) ----
  // Build the stroke OUTLINE in each element's LOCAL coords (uniform width) and
  // apply its CTM afterwards, matching how the browser strokes-then-transforms.
  // Every segment → a rectangle of width=strokeWidth; every interior vertex → a
  // JOIN shape (round=disc / miter=tip / bevel=wedge; gentle turns on flattened
  // curves are treated as round = the exact offset); every open end → a CAP
  // (round=disc / square=extension / butt=none). Pieces share one winding and
  // are filled NON-ZERO, so overlaps stay solid and holes survive by absence.
  const FLATNESS = 0.008 // max bezier→line chord error, in viewBox units (finer = smoother curves)
  const CORNER_DEG = 30 // turns gentler than this = smooth-curve facet (round)

  // <rect> → <path>: paper's rect-rx shape expansion corrupts under a matrix.
  const ATTR_RE = /([\w:.\-]+)\s*=\s*("[^"]*"|'[^']*')/g
  function parseAttrs(s: string): Array<[string, string]> {
    const pairs: Array<[string, string]> = []
    let m: RegExpExecArray | null
    ATTR_RE.lastIndex = 0
    while ((m = ATTR_RE.exec(s))) pairs.push([m[1], m[2].slice(1, -1)])
    return pairs
  }
  const RECT_GEOM: Record<string, 1> = { x: 1, y: 1, width: 1, height: 1, rx: 1, ry: 1 }
  function rectToPath(attrStr: string): string | null {
    const pairs = parseAttrs(attrStr)
    const map: Record<string, string> = {}
    for (const [k, v] of pairs) if (!(k in map)) map[k] = v
    const num = (n: string, d: number) => {
      const v = map[n]
      const f = v == null ? d : parseFloat(v)
      return Number.isFinite(f) ? f : d
    }
    const x = num('x', 0), y = num('y', 0), w = num('width', 0), h = num('height', 0)
    if (!(w > 0 && h > 0)) return null
    const hasRx = 'rx' in map, hasRy = 'ry' in map
    let rx = hasRx ? num('rx', 0) : hasRy ? num('ry', 0) : 0
    let ry = hasRy ? num('ry', 0) : hasRx ? num('rx', 0) : 0
    rx = Math.min(Math.max(rx, 0), w / 2)
    ry = Math.min(Math.max(ry, 0), h / 2)
    const d =
      rx > 0 && ry > 0
        ? `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}` +
          `A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
          `V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
        : `M${x},${y}H${x + w}V${y + h}H${x}Z`
    const rest = pairs.filter(([k]) => !RECT_GEOM[k]).map(([k, v]) => ` ${k}="${v}"`).join('')
    return `<path d="${d}"${rest}/>`
  }
  function expandRects(svg: string): string {
    return svg.replace(/<rect\b((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>(\s*<\/rect\s*>)?/g,
      (m, attrs) => rectToPath(attrs) || m)
  }

  const poly = (pts: any[]): any => {
    const p = new paper.Path({ segments: pts, closed: true, insert: false })
    if (Math.abs(p.area) < 1e-7) { p.remove(); return null }
    if (!p.clockwise) p.reverse()
    return p
  }
  const disc = (center: any, r: number): any => {
    const c = new paper.Path.Circle({ center, radius: r, insert: false })
    if (!c.clockwise) c.reverse()
    return c
  }
  const lineIntersect = (p1: any, d1: any, p2: any, d2: any): any => {
    const den = d1.x * d2.y - d1.y * d2.x
    if (Math.abs(den) < 1e-9) return null
    const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
    return p1.add(d1.multiply(t))
  }
  // Max singular value of the CTM's linear part — keeps flatten error bounded
  // along the most-stretched axis of anisotropic/skew transforms.
  const ctmScale = (M: any): number => {
    const A = M.a * M.a + M.b * M.b, D = M.c * M.c + M.d * M.d, B = M.a * M.c + M.b * M.d
    return Math.sqrt((A + D) / 2 + Math.sqrt(Math.max(0, ((A - D) / 2) ** 2 + B * B))) || 1
  }

  function strokePieces(
    points: any[], closed: boolean, hw: number, cap: string, join: string, miterLimit: number
  ): any[] {
    const pieces: any[] = []
    const P: any[] = []
    for (const pt of points) if (!P.length || P[P.length - 1].getDistance(pt) > 1e-6) P.push(pt)
    if (closed && P.length > 1 && P[0].getDistance(P[P.length - 1]) < 1e-6) P.pop()
    const m = P.length
    if (m < 2) {
      if (m === 1 && cap === 'round') { const d = disc(P[0], hw); if (d) pieces.push(d) }
      return pieces
    }
    const segCount = closed ? m : m - 1
    const dirs: any[] = [], nrms: any[] = []
    for (let i = 0; i < segCount; i++) {
      const a = P[i], b = P[(i + 1) % m]
      const v = b.subtract(a), len = v.length
      if (len < 1e-9) { dirs.push(null); nrms.push(null); continue }
      const u = v.divide(len)
      dirs.push(u); nrms.push(new paper.Point(-u.y, u.x))
    }
    for (let i = 0; i < segCount; i++) {
      if (!dirs[i]) continue
      const a = P[i], b = P[(i + 1) % m], off = nrms[i].multiply(hw)
      const q = poly([a.add(off), b.add(off), b.subtract(off), a.subtract(off)])
      if (q) pieces.push(q)
    }
    const addJoin = (i: number, inSeg: number, outSeg: number) => {
      const v = P[i], nin = nrms[inSeg], nout = nrms[outSeg], din = dirs[inSeg], dout = dirs[outSeg]
      if (!nin || !nout) return
      if (din.dot(dout) > 0.99999) return
      const turn = (Math.acos(Math.max(-1, Math.min(1, din.dot(dout)))) * 180) / Math.PI
      const effJoin = turn < CORNER_DEG ? 'round' : join
      if (effJoin === 'round') { const d = disc(v, hw); if (d) pieces.push(d); return }
      const t1 = poly([v, v.add(nin.multiply(hw)), v.add(nout.multiply(hw))]); if (t1) pieces.push(t1)
      const t2 = poly([v, v.subtract(nin.multiply(hw)), v.subtract(nout.multiply(hw))]); if (t2) pieces.push(t2)
      if (effJoin === 'miter') {
        const cross = din.x * dout.y - din.y * dout.x
        const s = cross < 0 ? 1 : -1
        const p1 = v.add(nin.multiply(hw * s)), p2 = v.add(nout.multiply(hw * s))
        const mp = lineIntersect(p1, din, p2, dout)
        if (mp && mp.getDistance(v) / hw <= miterLimit) { const tip = poly([p1, mp, p2]); if (tip) pieces.push(tip) }
      }
    }
    if (closed) for (let i = 0; i < m; i++) addJoin(i, (i - 1 + segCount) % segCount, i % segCount)
    else for (let i = 1; i < m - 1; i++) addJoin(i, i - 1, i)
    if (!closed) {
      const addCap = (pt: any, dir: any, nrm: any, sgn: number) => {
        if (!dir) return
        if (cap === 'round') { const d = disc(pt, hw); if (d) pieces.push(d); return }
        if (cap === 'square') {
          const ext = dir.multiply(hw * sgn), off = nrm.multiply(hw)
          const q = poly([pt.add(off), pt.add(off).add(ext), pt.subtract(off).add(ext), pt.subtract(off)])
          if (q) pieces.push(q)
        }
      }
      addCap(P[0], dirs[0], nrms[0], -1)
      const last = segCount - 1
      addCap(P[m - 1], dirs[last], nrms[last], 1)
    }
    return pieces
  }

  // Convert every stroke to a filled outline (transform-correct) and pass fills
  // through, returning one merged non-zero path. Imports with applyMatrix:false
  // so each leaf keeps LOCAL geometry + a globalMatrix (CTM) to apply afterwards.
  function outlineStrokesToPathData(svg: string): string {
    paper.project.clear()
    const root = paper.project.importSVG(prepSvg(svg), {
      expandShapes: true,
      applyMatrix: false,
      insert: false
    })
    const all: any[] = []
    for (const leaf of collectLeaves(root)) {
      const M = leaf.globalMatrix
      const ident = M.isIdentity()
      const lin = ctmScale(M)
      const pieces: any[] = []
      if (isStroked(leaf)) {
        const hw = strokeWidthOf(leaf) / 2
        const cap = leaf.strokeCap || 'butt'
        const join = leaf.strokeJoin || 'miter'
        const ml = leaf.miterLimit || 4
        const subs = leaf.className === 'CompoundPath' ? leaf.children : [leaf]
        for (const sp of subs) {
          const fp = sp.clone({ insert: false })
          fp.flatten(FLATNESS / lin)
          pieces.push(...strokePieces(fp.segments.map((s: any) => s.point), sp.closed, hw, cap, join, ml))
          fp.remove()
        }
      }
      if (hasFillPaint(leaf)) {
        const fc = new paper.CompoundPath(leaf.pathData)
        fc.insert = false
        if (fc.children && fc.children.length > 1) fc.reorient(fillRuleOf(leaf) === 'nonzero', true)
        const fsubs = fc.children && fc.children.length ? fc.children : [fc]
        for (const sp of fsubs) pieces.push(sp.clone({ insert: false }))
        fc.remove()
      }
      for (const p of pieces) {
        if (!ident) p.transform(M)
        all.push(p)
      }
    }
    if (!all.length) return ''
    const merged = new paper.CompoundPath({ children: all, insert: false })
    const d = merged.pathData
    merged.remove()
    return d
  }

  function importLeaves(svg: string): any[] {
    paper.project.clear()
    const root = paper.project.importSVG(prepSvg(svg), { expandShapes: true, insert: false })
    return collectLeaves(root).map((l) => l.clone({ insert: false }))
  }

  function repairToPathData(svg: string): string {
    const leaves = importLeaves(svg)
    if (!leaves.length) return ''

    // Fill-only icons: reorient each path for non-zero, concat contours (no boolean
    // union — keeps full fidelity for the common case).
    if (!leaves.some(isStroked)) {
      const contours: any[] = []
      for (const leaf of leaves.map(normalizeLeaf)) {
        const subs = leaf.className === 'CompoundPath' ? leaf.children : [leaf]
        for (const sp of subs) contours.push(sp.clone({ insert: false }))
      }
      return new paper.CompoundPath({ children: contours, insert: false }).pathData
    }

    // Stroke present: preferred path is maker.js (smooth true-arc outline, tiny,
    // single clean contour). Falls back to the geometric outliner if maker isn't
    // injected (keeps the module usable without the dependency).
    return makerStroke ? makerStroke.toPathData(svg).d : outlineStrokesToPathData(svg)
  }

  function repairSvg(svg: string): string {
    const vb = getViewBox(svg)
    const d = repairToPathData(svg)
    // paper bakes the viewBox's translate(-vbx,-vby) into the geometry, so the
    // output is already 0-origin — emit a 0-origin viewBox to match.
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb.w} ${vb.h}">` +
      `<path fill="currentColor" d="${d}"/></svg>`
    )
  }

  function contourSet(leaves: any[]): string {
    const ds: string[] = []
    for (const leaf of leaves) {
      const subs = leaf.className === 'CompoundPath' ? leaf.children : [leaf]
      for (const sp of subs) ds.push(sp.pathData)
    }
    return ds.sort().join('\n')
  }

  // Reorient a cloned leaf to a canonical orientation, interpreting its current
  // geometry under the given rule. Same clockwise convention on both views
  // cancels cosmetic uniform flips, leaving only real fill differences.
  function canonClone(leaf: any, interpretAsNonZero: boolean): any {
    const clone = leaf.clone({ insert: false })
    if (clone.className === 'CompoundPath' && clone.children.length > 1) {
      clone.reorient(interpretAsNonZero || fillRuleOf(clone) === 'nonzero', true)
    }
    return clone
  }

  // Needs repair iff the font's view (raw geometry filled non-zero) fills
  // differently than what the source intends (its own fill-rule). One import,
  // two cloned interpretations — cheaper for whole-list scans.
  function analyze(svg: string): { needsRepair: boolean } {
    const leaves = importLeaves(svg)
    const fontView = contourSet(leaves.map((l) => canonClone(l, true)))
    const intended = contourSet(leaves.map((l) => canonClone(l, false)))
    return { needsRepair: fontView !== intended }
  }

  return { repairToPathData, repairSvg, analyze }
}

// ----- browser entry: lazy paper-core in a dedicated scope -----

let repairerP: Promise<SvgRepairer> | null = null

function getRepairer(): Promise<SvgRepairer> {
  if (!repairerP) {
    repairerP = (async () => {
      const [paperMod, makerMod] = await Promise.all([
        import('paper/dist/paper-core'),
        import('makerjs').catch(() => null), // optional: fall back to geometric if absent
      ])
      const paper: any = (paperMod as any).default ?? paperMod
      const scope = new paper.PaperScope()
      scope.setup(new scope.Size(1024, 1024))
      scope.activate()
      const maker: any = makerMod ? ((makerMod as any).default ?? makerMod) : null
      const makerStroke = maker ? createMakerStroke(scope, maker) : undefined
      return createSvgRepairer(scope, makerStroke)
    })()
  }
  return repairerP
}

export interface IconRepairResult {
  needsRepair: boolean
  /** false = detected but not auto-fixable (reserved; currently all issues are fixable). */
  supported: boolean
  reason: 'ok' | 'winding' | 'stroke'
  /** repaired SVG, present when needsRepair && supported. */
  repaired?: string
}

/** Lightweight check (no repaired payload) — for scanning the whole icon list. */
export async function analyzeIcon(svg: string): Promise<IconRepairResult> {
  // Stroke icons vanish in fonts (strokes aren't filled) — fixable by outlining
  // the stroke into a filled shape (repairSvg handles it).
  if (hasStroke(svg)) {
    return { needsRepair: true, supported: true, reason: 'stroke' }
  }
  const repairer = await getRepairer()
  if (!repairer.analyze(svg).needsRepair) {
    return { needsRepair: false, supported: true, reason: 'ok' }
  }
  return { needsRepair: true, supported: true, reason: 'winding' }
}

/** Detail-page detection — same as analyzeIcon plus the repaired SVG when fixable. */
export async function detectIconIssue(svg: string): Promise<IconRepairResult> {
  const info = await analyzeIcon(svg)
  if (info.needsRepair && info.supported) {
    info.repaired = (await getRepairer()).repairSvg(svg)
  }
  return info
}

/** Repair an SVG to font-safe geometry (one `<path>`, non-zero-correct winding). */
export async function repairSvg(svg: string): Promise<string> {
  return (await getRepairer()).repairSvg(svg)
}
