// A visible stroke = stroke= with a real value (not none/transparent). `\bstroke`
// avoids matching stroke-width / stroke-linecap / etc.
const STROKE_RE = /\bstroke\s*=\s*['"](?!none|transparent)[^'"]+['"]/i

/** Does the SVG paint a visible stroke? Strokes vanish when rasterized as a glyph. */
export function hasStroke(svg: string): boolean {
  return STROKE_RE.test(svg)
}
