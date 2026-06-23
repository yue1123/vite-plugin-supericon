/**
 * repair-svg — convert an SVG icon into FONT-SAFE geometry.
 *
 * WHY: icon fonts (TTF/OTF/WOFF) rasterize each glyph with the NON-ZERO winding
 * rule and completely ignore SVG `fill-rule`. svgicons2svgfont / fantasticon /
 * fontello drop the attribute and dump raw geometry. So an icon authored with
 * `fill-rule="evenodd"` — or with nested holes whose contours wind the SAME way —
 * renders with its holes filled solid once it becomes a glyph.
 *
 * FIX (a.k.a. FontForge "Correct Direction" / Figma "Flatten", Illustrator
 * "Compound Path"): reorient every path so it is non-zero-correct under ITS OWN
 * declared fill-rule (holes wound opposite their container), then merge all
 * contours into a single path. The result fills identically under the non-zero
 * rule, so the font glyph matches the source SVG.
 *
 * Portable: pass a paper.js scope.
 *   Browser: createSvgRepairer(paper)
 *   Node:    createSvgRepairer(require('paper-jsdom'))   // canvas-less, geometry only
 */
function createSvgRepairer(paper) {
  if (!paper.project) {
    // Geometry-only setup; no visible canvas / rendering needed.
    paper.setup(new paper.Size(1024, 1024));
  }

  function getViewBox(svg) {
    const m = svg.match(/viewBox\s*=\s*"([\d.+\-eE\s]+)"/);
    if (m) {
      const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
      if ([x, y, w, h].every((n) => Number.isFinite(n))) return { x, y, w, h };
    }
    return { x: 0, y: 0, w: 24, h: 24 };
  }

  // paper resolves width="1em" as 1 user unit and squashes the viewBox into [0,1].
  // Force width/height to the viewBox size so geometry stays in viewBox units.
  function prepSvg(svg) {
    const vb = getViewBox(svg);
    return svg.replace(/<svg\b[^>]*>/, (tag) =>
      tag
        .replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, '')
        .replace('<svg', `<svg width="${vb.w}" height="${vb.h}"`)
    );
  }

  function fillRuleOf(item) {
    const fr = item.fillRule || (item.style && item.style.fillRule);
    return fr === 'evenodd' ? 'evenodd' : 'nonzero';
  }

  function collectLeaves(root, out = []) {
    if (!root) return out;
    if (root.className === 'Path' || root.className === 'CompoundPath') {
      out.push(root);
    } else if (root.children) {
      for (const child of root.children) collectLeaves(child, out);
    }
    return out;
  }

  // Make a multi-subpath path non-zero-correct (holes wound opposite their
  // container), interpreting the CURRENT geometry under its own fill-rule.
  function normalizeLeaf(item) {
    if (item.className === 'CompoundPath' && item.children.length > 1) {
      const interpretAsNonZero = fillRuleOf(item) === 'nonzero';
      item.reorient(interpretAsNonZero, true /* outer clockwise */);
    }
    return item;
  }

  /** Repair to a single SVG path-data string with non-zero-correct winding. */
  function repairToPathData(svg) {
    paper.project.clear();
    const root = paper.project.importSVG(prepSvg(svg), {
      expandShapes: true, // circle/rect/polygon/... -> path geometry
      insert: false,
    });
    const leaves = collectLeaves(root).map((l) => l.clone({ insert: false }));
    if (!leaves.length) return '';

    const contours = [];
    for (const leaf of leaves.map(normalizeLeaf)) {
      const subs = leaf.className === 'CompoundPath' ? leaf.children : [leaf];
      for (const sp of subs) contours.push(sp.clone({ insert: false }));
    }
    const merged = new paper.CompoundPath({ children: contours, insert: false });
    return merged.pathData;
  }

  /** Repair to a clean single-path SVG string (default non-zero fill). */
  function repairSvg(svg) {
    const vb = getViewBox(svg);
    const d = repairToPathData(svg);
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">` +
      `<path fill="currentColor" d="${d}"/></svg>`
    );
  }

  return { repairSvg, repairToPathData, getViewBox };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createSvgRepairer };
if (typeof window !== 'undefined') window.createSvgRepairer = createSvgRepairer;
