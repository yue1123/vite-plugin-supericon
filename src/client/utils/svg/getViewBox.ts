type ViewBox = { x: number; y: number; w: number; h: number }

export function getViewBox(svg: string): ViewBox {
  const m = svg.match(/viewBox\s*=\s*"([\d.+\-eE\s,]+)"/)
  if (m) {
    const [x, y, w, h] = m[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if ([x, y, w, h].every((n) => Number.isFinite(n))) return { x, y, w, h }
  }
  return { x: 0, y: 0, w: 24, h: 24 }
}
