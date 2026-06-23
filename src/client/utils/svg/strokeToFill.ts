/**
 * Geometric stroke -> fill via maker.js (Apache-2.0), with paper.js for parse-
 * adjacent placement/winding and the element CTM.
 *
 * Pipeline (validated in svg-font-repair-lab):
 *   1. DOMParser walks the SVG: per drawable element we compute its cascaded
 *      stroke props, its CTM (composed transform attrs), and an ARC-PRESERVING
 *      local path `d` (rect/circle/ellipse -> arc paths, so maker keeps true
 *      arcs instead of breaking on paper's bezier-ified circles).
 *   2. maker `expandPaths` offsets each stroke group into a clean filled outline
 *      (real lines + arcs -> smooth, tiny, no overlapping pieces).
 *   3. paper places the (re-origined) outline by center-matching it to the
 *      centerline, reorients holes for non-zero, adds caps, and applies the CTM.
 *
 * Output: one non-zero `<path>` d — smooth, compact, font-safe. Fills pass
 * through (reoriented). `paper`/`maker` are injected so the core stays portable.
 */

type Maker = any
type Paper = any

const DRAW = new Set(['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse'])
const isVisible = (v: string | null) => v != null && v !== 'none' && v !== 'transparent'

function attrNum(el: Element, a: string, d = 0): number {
  const v = el.getAttribute(a)
  const f = v == null ? d : parseFloat(v)
  return Number.isFinite(f) ? f : d
}

// shape element -> arc-preserving LOCAL path data
function shapeToD(el: Element): string {
  const t = el.tagName.toLowerCase()
  if (t === 'path') return el.getAttribute('d') || ''
  if (t === 'line') return `M${attrNum(el,'x1')},${attrNum(el,'y1')}L${attrNum(el,'x2')},${attrNum(el,'y2')}`
  if (t === 'polyline' || t === 'polygon') {
    const p = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite)
    if (p.length < 4) return ''
    let d = `M${p[0]},${p[1]}`
    for (let i = 2; i < p.length - 1; i += 2) d += `L${p[i]},${p[i + 1]}`
    return t === 'polygon' ? d + 'Z' : d
  }
  if (t === 'rect') {
    const x = attrNum(el,'x'), y = attrNum(el,'y'), w = attrNum(el,'width'), h = attrNum(el,'height')
    if (!(w > 0 && h > 0)) return ''
    let rx = el.hasAttribute('rx') ? attrNum(el,'rx') : (el.hasAttribute('ry') ? attrNum(el,'ry') : 0)
    let ry = el.hasAttribute('ry') ? attrNum(el,'ry') : (el.hasAttribute('rx') ? attrNum(el,'rx') : 0)
    rx = Math.min(Math.max(rx, 0), w / 2); ry = Math.min(Math.max(ry, 0), h / 2)
    return (rx > 0 && ry > 0)
      ? `M${x+rx},${y}H${x+w-rx}A${rx},${ry} 0 0 1 ${x+w},${y+ry}V${y+h-ry}A${rx},${ry} 0 0 1 ${x+w-rx},${y+h}H${x+rx}A${rx},${ry} 0 0 1 ${x},${y+h-ry}V${y+ry}A${rx},${ry} 0 0 1 ${x+rx},${y}Z`
      : `M${x},${y}H${x+w}V${y+h}H${x}Z`
  }
  if (t === 'circle') { const cx=attrNum(el,'cx'),cy=attrNum(el,'cy'),r=attrNum(el,'r'); if (r<=0) return ''; return `M${cx-r},${cy}A${r},${r} 0 1 0 ${cx+r},${cy}A${r},${r} 0 1 0 ${cx-r},${cy}Z` }
  if (t === 'ellipse') { const cx=attrNum(el,'cx'),cy=attrNum(el,'cy'),rx=attrNum(el,'rx'),ry=attrNum(el,'ry'); if (rx<=0||ry<=0) return ''; return `M${cx-rx},${cy}A${rx},${ry} 0 1 0 ${cx+rx},${cy}A${rx},${ry} 0 1 0 ${cx-rx},${cy}Z` }
  return ''
}

export function createMakerStroke(paper: Paper, maker: Maker) {
  if (!paper.project) paper.setup(new paper.Size(1024, 1024))

  // transform attribute -> paper.Matrix
  function parseTransform(str: string | null): any {
    const m = new paper.Matrix()
    if (!str) return m
    const re = /(\w+)\s*\(([^)]*)\)/g
    let g: RegExpExecArray | null
    while ((g = re.exec(str))) {
      const fn = g[1], a = g[2].trim().split(/[\s,]+/).map(Number)
      const t = new paper.Matrix()
      if (fn === 'translate') t.translate(a[0] || 0, a[1] || 0)
      else if (fn === 'scale') t.scale(a[0] ?? 1, a.length > 1 ? a[1] : (a[0] ?? 1))
      else if (fn === 'rotate') a.length >= 3 ? t.rotate(a[0], new paper.Point(a[1], a[2])) : t.rotate(a[0] || 0, new paper.Point(0, 0))
      else if (fn === 'matrix') t.set(a[0], a[1], a[2], a[3], a[4], a[5])
      else if (fn === 'skewX') t.skew(a[0] || 0, 0)
      else if (fn === 'skewY') t.skew(0, a[0] || 0)
      m.append(t)
    }
    return m
  }

  function prop(el: Element, name: string): string | null {
    const style = el.getAttribute('style')
    if (style) { const m = style.match(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)')); if (m) return m[1].trim() }
    return el.getAttribute(name)
  }

  interface Parsed { d: string; ctm: any; props: Record<string, string | null> }
  function parseSVG(svgStr: string): { vb: { x: number; y: number; w: number; h: number }; els: Parsed[] } {
    const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
    const svg = doc.querySelector('svg')!
    let vb = { x: 0, y: 0, w: 24, h: 24 }
    const va = svg.getAttribute('viewBox')
    if (va) { const [x, y, w, h] = va.trim().split(/[\s,]+/).map(Number); if ([x, y, w, h].every(Number.isFinite)) vb = { x, y, w, h } }
    const els: Parsed[] = []
    const read = (el: Element, inh: Record<string, string | null>) => ({
      sw: prop(el,'stroke-width') ?? inh.sw, cap: prop(el,'stroke-linecap') ?? inh.cap,
      join: prop(el,'stroke-linejoin') ?? inh.join, ml: prop(el,'stroke-miterlimit') ?? inh.ml,
      stroke: prop(el,'stroke') ?? inh.stroke, fill: prop(el,'fill') ?? inh.fill, fillRule: prop(el,'fill-rule') ?? inh.fillRule,
    })
    const DEF = { sw: '1', cap: 'butt', join: 'miter', ml: '4', stroke: null, fill: null, fillRule: null } as Record<string, string | null>
    ;(function walk(node: Element, mat: any, inh: Record<string, string | null>) {
      for (const child of Array.from(node.children)) {
        const t = child.tagName.toLowerCase()
        const cm = mat.clone().append(parseTransform(child.getAttribute('transform')))
        const p = read(child, inh)
        if (t === 'g' || t === 'svg') walk(child, cm, p)
        else if (DRAW.has(t)) { const d = shapeToD(child); if (d) els.push({ d, ctm: cm, props: p }) }
      }
    })(svg, new paper.Matrix(), read(svg, DEF))
    return { vb, els }
  }

  const cw = (p: any) => { if (!p.clockwise) p.reverse(); return p }
  const mkey = (M: any) => [M.a, M.b, M.c, M.d, M.tx, M.ty].map((n: number) => n.toFixed(5)).join(',')

  /** stroke->fill (+ pass-through fills) as a single non-zero path-data string, in 0-origin viewBox space. */
  function toPathData(svgStr: string): { d: string; vb: { x: number; y: number; w: number; h: number } } {
    const { vb, els } = parseSVG(svgStr)
    const contours: string[] = []
    const groups = new Map<string, { M: any; h: number; joints: number; ds: string[]; caps: Array<{ x: number; y: number; cap: string }> }>()
    for (const el of els) {
      const sw = parseFloat(el.props.sw as string) || 1, h = sw / 2
      const stroked = isVisible(el.props.stroke as string) && sw > 0
      const filled = isVisible(el.props.fill as string) || (el.props.fill == null && !stroked)
      const M = el.ctm
      if (stroked) {
        const join = el.props.join || 'miter', cap = el.props.cap || 'butt'
        const key = mkey(M) + '|' + h + '|' + join
        let g = groups.get(key)
        if (!g) { g = { M, h, joints: join === 'round' ? 1 : 0, ds: [], caps: [] }; groups.set(key, g) }
        g.ds.push(el.d)
        if (cap !== 'butt') {
          const lp = new paper.CompoundPath(el.d); lp.insert = false
          const subs = lp.children && lp.children.length ? lp.children : [lp]
          for (const sp of subs) if (!sp.closed) for (const pt of [sp.firstSegment.point, sp.lastSegment.point]) g.caps.push({ x: pt.x, y: pt.y, cap })
          lp.remove()
        }
      }
      if (filled) {
        const fp = new paper.CompoundPath(el.d); fp.insert = false
        if (fp.children && fp.children.length > 1) fp.reorient(el.props.fillRule !== 'evenodd', true)
        if (!M.isIdentity()) fp.transform(M)
        ;(fp.children && fp.children.length ? fp.children : [fp]).forEach((c: any) => contours.push(c.pathData))
        fp.remove()
      }
    }
    for (const g of groups.values()) {
      const combined = g.ds.join(' ')
      let bandD = ''
      try {
        const strokes: any = { models: {} }
        g.ds.forEach((d, i) => { strokes.models['s' + i] = maker.importer.fromSVGPathData(d) })
        const band = maker.model.expandPaths(strokes, g.h, g.joints)
        const md = maker.exporter.toSVGPathData(band, { accuracy: 0.004 })
        bandD = typeof md === 'string' ? md : Object.values(md).join(' ')
      } catch { bandD = '' }
      const items: any[] = []
      if (bandD) {
        const cl = new paper.CompoundPath(combined); cl.insert = false
        const bp = new paper.CompoundPath(bandD); bp.insert = false
        bp.translate(cl.bounds.center.subtract(bp.bounds.center)) // outline is centered on the centerline
        if (bp.children && bp.children.length > 1) bp.reorient(false, true)
        items.push(bp); cl.remove()
      }
      // KNOWN LIMITATION: round caps on open lines aren't pixel-perfect — a
      // radius-h disc is overlaid at each endpoint and merged via non-zero, so
      // the cap arc / capsule-end join has a tiny seam (the `caps` test ~2.2%,
      // the worst case). Good enough for now; revisit (native maker round caps,
      // or a half-circle tangent to the capsule end) when other work is done.
      for (const c of g.caps) items.push(cw(c.cap === 'round'
        ? new paper.Path.Circle({ center: [c.x, c.y], radius: g.h, insert: false })
        : new paper.Path.Rectangle({ from: [c.x - g.h, c.y - g.h], to: [c.x + g.h, c.y + g.h], insert: false })))
      for (const it of items) { if (!g.M.isIdentity()) it.transform(g.M); (it.children && it.children.length ? it.children : [it]).forEach((c: any) => contours.push(c.pathData)); it.remove() }
    }
    let d = contours.filter(Boolean).join(' ')
    if (d && (vb.x || vb.y)) { // normalize to 0-origin (paper-style), matching repairSvg's emitted viewBox
      const cp = new paper.CompoundPath(d); cp.insert = false
      cp.translate(new paper.Point(-vb.x, -vb.y)); d = cp.pathData; cp.remove()
    }
    return { d, vb }
  }

  function toSvg(svgStr: string): string {
    const { d, vb } = toPathData(svgStr)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb.w} ${vb.h}"><path fill="currentColor" d="${d}"/></svg>`
  }

  return { toPathData, toSvg }
}
