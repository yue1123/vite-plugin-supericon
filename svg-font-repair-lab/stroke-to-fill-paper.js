/**
 * stroke-to-fill (paper) — GEOMETRIC stroke->fill, MIT, no tracing, no raster.
 *
 * For each stroked element we build the stroke outline by hand IN ITS LOCAL
 * coordinate system (so stroke-width stays uniform): every segment -> a
 * rectangle of width=strokeWidth; every interior vertex -> a JOIN shape
 * (round=disc / miter=tip / bevel=wedge), with gentle turns on a flattened
 * curve treated as smooth (round disc = the exact offset); every open end -> a
 * CAP shape (round=disc / square=extension / butt=none). Then we apply the
 * element's full CTM (globalMatrix) to the OUTLINE — matching how the browser
 * strokes-then-transforms, so rotate / scale / non-uniform-scale (elliptical
 * strokes) / skew / nested-group transforms all come out right.
 *
 * All pieces are wound the same way and merged into ONE path filled with the
 * NON-ZERO rule: overlaps add (stay solid), holes survive by ABSENCE of
 * geometry. No boolean union (avoids paper's union error), and the result is
 * font-safe (non-zero, no fill-rule needed).
 *
 * Portable factory, like repair-svg.js — pass a paper scope:
 *   Browser: createStrokeToFill(paper)
 *   Node:    createStrokeToFill(require('paper-jsdom'))   // canvas-less, geometry only
 *
 * Returns { strokeToFillSvg, strokeToFillPath, getViewBox }.
 *
 * Not handled (rare in icon sets): vector-effect="non-scaling-stroke",
 * stroke-dasharray. Pure-fill icons with even-odd holes should still go through
 * repair-svg.js; this module only converts STROKES (fills pass through, with
 * multi-subpath fills reoriented for non-zero safety).
 */
function createStrokeToFill(paper) {
  if (!paper.project) paper.setup(new paper.Size(1024, 1024)); // geometry-only setup

  function getViewBox(svg) {
    const m = svg.match(/viewBox\s*=\s*"([\d.+\-eE\s,]+)"/);
    if (m) {
      const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
      if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) return { x, y, w, h };
    }
    return { x: 0, y: 0, w: 24, h: 24 };
  }

  // paper's expandShapes mis-expands <rect rx> when the item carries a transform
  // (rounded corners collapse to sharp). paper handles <path> arcs correctly, so
  // we rewrite every <rect> to an equivalent <path> ourselves before import.
  // Tokenize an attribute string into ordered [name, value] pairs, consuming
  // whole single- OR double-quoted values (so a '>' or a `width="5"` substring
  // inside a value can't truncate the tag or leak into geometry).
  const ATTR_RE = /([\w:.\-]+)\s*=\s*("[^"]*"|'[^']*')/g;
  function parseAttrs(s) {
    const pairs = []; let m; ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(s))) pairs.push([m[1], m[2].slice(1, -1)]);
    return pairs;
  }
  const RECT_GEOM = { x: 1, y: 1, width: 1, height: 1, rx: 1, ry: 1 };
  function rectToPath(attrStr) {
    const pairs = parseAttrs(attrStr);
    const map = {}; for (const [k, v] of pairs) if (!(k in map)) map[k] = v;
    const num = (n, dflt) => { const v = map[n]; const f = v == null ? dflt : parseFloat(v); return Number.isFinite(f) ? f : dflt; };
    const x = num('x', 0), y = num('y', 0), w = num('width', 0), h = num('height', 0);
    if (!(w > 0 && h > 0)) return null;
    const hasRx = 'rx' in map, hasRy = 'ry' in map;
    let rx = hasRx ? num('rx', 0) : (hasRy ? num('ry', 0) : 0);
    let ry = hasRy ? num('ry', 0) : (hasRx ? num('rx', 0) : 0);
    rx = Math.min(Math.max(rx, 0), w / 2); ry = Math.min(Math.max(ry, 0), h / 2);
    const d = (rx > 0 && ry > 0)
      ? `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}` +
        `A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}` +
        `V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
    const rest = pairs.filter(([k]) => !RECT_GEOM[k]).map(([k, v]) => ` ${k}="${v}"`).join('');
    return `<path d="${d}"${rest}/>`;
  }
  // Quote-aware tag matcher: the attr group consumes non-quote chars OR whole
  // quoted strings, so '>' inside a value won't end the tag prematurely.
  function expandRects(svg) {
    return svg.replace(/<rect\b((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>(\s*<\/rect\s*>)?/g,
      (m, attrs) => rectToPath(attrs) || m);
  }

  // paper squashes width="1em" into [0,1]; force width/height to the viewBox size.
  function prepSvg(svg, vb) {
    return expandRects(svg).replace(/<svg\b[^>]*>/, (tag) =>
      tag.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, '').replace('<svg', `<svg width="${vb.w}" height="${vb.h}"`));
  }

  // Closed polygon piece from points, normalized to a consistent winding.
  function poly(pts) {
    const p = new paper.Path({ segments: pts, closed: true, insert: false });
    if (Math.abs(p.area) < 1e-7) { p.remove(); return null; } // drop degenerate slivers
    if (!p.clockwise) p.reverse();
    return p;
  }
  function disc(center, r) {
    const c = new paper.Path.Circle({ center: center, radius: r, insert: false });
    if (!c.clockwise) c.reverse();
    return c;
  }
  function lineIntersect(p1, d1, p2, d2) {
    const den = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
    return p1.add(d1.multiply(t));
  }

  // Stroke-outline pieces for one flattened subpath, in LOCAL coordinates.
  function strokePieces(points, closed, h, cap, join, miterLimit, cornerDeg) {
    const pieces = [];
    const P = [];
    for (const pt of points) if (!P.length || P[P.length - 1].getDistance(pt) > 1e-6) P.push(pt);
    if (closed && P.length > 1 && P[0].getDistance(P[P.length - 1]) < 1e-6) P.pop();
    const m = P.length;
    if (m < 2) { if (m === 1 && cap === 'round') { const d = disc(P[0], h); if (d) pieces.push(d); } return pieces; }

    const segCount = closed ? m : m - 1;
    const dirs = [], nrms = [];
    for (let i = 0; i < segCount; i++) {
      const a = P[i], b = P[(i + 1) % m];
      const v = b.subtract(a), len = v.length;
      if (len < 1e-9) { dirs.push(null); nrms.push(null); continue; }
      const u = v.divide(len);
      dirs.push(u); nrms.push(new paper.Point(-u.y, u.x));
    }
    for (let i = 0; i < segCount; i++) {
      if (!dirs[i]) continue;
      const a = P[i], b = P[(i + 1) % m], off = nrms[i].multiply(h);
      const q = poly([a.add(off), b.add(off), b.subtract(off), a.subtract(off)]);
      if (q) pieces.push(q);
    }
    const addJoin = (i, inSeg, outSeg) => {
      const v = P[i], nin = nrms[inSeg], nout = nrms[outSeg], din = dirs[inSeg], dout = dirs[outSeg];
      if (!nin || !nout) return;
      if (din.dot(dout) > 0.99999) return; // collinear
      // A gentle turn on a flattened curve is not a real corner: the browser is
      // smooth there, so the exact offset is a round disc (Minkowski w/ disc).
      const turn = Math.acos(Math.max(-1, Math.min(1, din.dot(dout)))) * 180 / Math.PI;
      const effJoin = turn < cornerDeg ? 'round' : join;
      if (effJoin === 'round') { const d = disc(v, h); if (d) pieces.push(d); return; }
      const t1 = poly([v, v.add(nin.multiply(h)), v.add(nout.multiply(h))]); if (t1) pieces.push(t1);
      const t2 = poly([v, v.subtract(nin.multiply(h)), v.subtract(nout.multiply(h))]); if (t2) pieces.push(t2);
      if (effJoin === 'miter') {
        const cross = din.x * dout.y - din.y * dout.x;
        const s = cross < 0 ? 1 : -1;
        const p1 = v.add(nin.multiply(h * s)), p2 = v.add(nout.multiply(h * s));
        const mp = lineIntersect(p1, din, p2, dout);
        if (mp && mp.getDistance(v) / h <= miterLimit) { const tip = poly([p1, mp, p2]); if (tip) pieces.push(tip); }
      }
    };
    if (closed) for (let i = 0; i < m; i++) addJoin(i, (i - 1 + segCount) % segCount, i % segCount);
    else for (let i = 1; i < m - 1; i++) addJoin(i, i - 1, i);

    if (!closed) {
      const addCap = (pt, dir, nrm, sgn) => {
        if (!dir) return;
        if (cap === 'round') { const d = disc(pt, h); if (d) pieces.push(d); return; }
        if (cap === 'square') {
          const ext = dir.multiply(h * sgn), off = nrm.multiply(h);
          const q = poly([pt.add(off), pt.add(off).add(ext), pt.subtract(off).add(ext), pt.subtract(off)]);
          if (q) pieces.push(q);
        }
      };
      addCap(P[0], dirs[0], nrms[0], -1);
      const last = segCount - 1;
      addCap(P[m - 1], dirs[last], nrms[last], 1);
    }
    return pieces;
  }

  function collectLeaves(item, out) {
    if (!item) return out;
    if (item.className === 'Path' || item.className === 'CompoundPath') out.push(item);
    else if (item.children) item.children.forEach((c) => collectLeaves(c, out));
    return out;
  }

  // Finer flatness => tighter chords between the disc joins, so the union
  // envelope of the overlapping pieces has a smaller sub-pixel scallop at high
  // zoom. (We deliberately do NOT boolean-union the pieces: paper's
  // resolveCrossings/unite on many near-coincident pieces is unreliable — it
  // degraded square-x and outright broke the non-uniform ellipse. Overlapping
  // same-wound pieces under non-zero render as a clean union anyway.)
  const DEFAULTS = { flatness: 0.008, cornerDeg: 30 };

  function mergePieces(pieces) {
    if (!pieces.length) return '';
    const merged = new paper.CompoundPath({ children: pieces, insert: false });
    const d = merged.pathData;
    merged.remove();
    return d;
  }

  // -> { pieces: paper.Path[] (global coords, consistent winding), vb }
  function buildPieces(svgString, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const vb = getViewBox(svgString);
    paper.project.clear();
    // applyMatrix:false keeps geometry LOCAL + exposes each leaf's globalMatrix (CTM).
    const root = paper.project.importSVG(prepSvg(svgString, vb), {
      expandShapes: true, applyMatrix: false, insert: false,
    });
    const leaves = collectLeaves(root, []);
    const all = [];
    for (const leaf of leaves) {
      const M = leaf.globalMatrix;
      const ident = M.isIdentity();
      // Max singular value (operator norm) of the CTM's linear part, so the
      // flatten chord error never exceeds target along the MOST-stretched axis
      // (geometric mean sqrt(|det|) under-flattens anisotropic/skew transforms).
      const Aq = M.a * M.a + M.b * M.b, Dq = M.c * M.c + M.d * M.d, Bq = M.a * M.c + M.b * M.d;
      const lin = Math.sqrt((Aq + Dq) / 2 + Math.sqrt(Math.max(0, ((Aq - Dq) / 2) ** 2 + Bq * Bq))) || 1;
      const pieces = [];

      if (leaf.strokeColor && leaf.strokeWidth > 0) {
        const h = leaf.strokeWidth / 2;
        const cap = leaf.strokeCap || 'butt';
        const join = leaf.strokeJoin || 'miter';
        const ml = leaf.miterLimit || 4;
        const subs = leaf.className === 'CompoundPath' ? leaf.children : [leaf];
        for (const sp of subs) {
          const fp = sp.clone({ insert: false });
          fp.flatten(o.flatness / lin); // flatten in LOCAL units, scaled so global smoothness is steady
          pieces.push(...strokePieces(fp.segments.map((s) => s.point), sp.closed, h, cap, join, ml, o.cornerDeg));
          fp.remove();
        }
      }

      if (leaf.fillColor != null) {
        // pass the fill through; reorient multi-subpath fills so holes are
        // non-zero-correct. Built fresh from LOCAL path data (identity matrix).
        const fc = new paper.CompoundPath(leaf.pathData);
        fc.insert = false;
        if (fc.children && fc.children.length > 1) fc.reorient(leaf.fillRule !== 'evenodd', true);
        const fsubs = fc.children && fc.children.length ? fc.children : [fc];
        for (const sp of fsubs) pieces.push(sp.clone({ insert: false }));
        fc.remove();
      }

      for (const p of pieces) { if (!ident) p.transform(M); all.push(p); }
    }
    return { pieces: all, vb };
  }

  /** Stroke->fill as a single non-zero path-data string. */
  function strokeToFillPath(svgString, opts) {
    const { pieces } = buildPieces(svgString, opts);
    return mergePieces(pieces);
  }

  /** Stroke->fill as a clean single-<path> fill SVG. */
  function strokeToFillSvg(svgString, opts) {
    const { pieces, vb } = buildPieces(svgString, opts);
    const d = mergePieces(pieces);
    // paper bakes the viewBox's translate(-vbx,-vby) into the geometry, so the
    // output is already in 0-origin space — emit a 0-origin viewBox to match.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb.w} ${vb.h}">` +
      `<path fill="currentColor" d="${d}"/></svg>`;
    return { svg, d, pieces: pieces.length };
  }

  return { strokeToFillSvg, strokeToFillPath, getViewBox };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createStrokeToFill };
if (typeof window !== 'undefined') window.createStrokeToFill = createStrokeToFill;
