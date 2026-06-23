/**
 * Duplicate icon detection
 *
 * Same drawing under different names = duplicate. We hash the NORMALIZED geometry
 * so cosmetic differences don't hide a dup: color, formatting/whitespace, number
 * precision, attribute order and element order are all ignored; geometry +
 * fill-rule + transform are kept. Same hash ⇒ same drawing (no false positives).
 *
 * Misses (acceptable — never auto-deletes, only flags for review): the same shape
 * re-encoded differently (relative vs absolute commands, arc vs bézier). Those
 * would need full geometric canonicalization (paper) — out of scope here.
 */

import { fnv1a } from './hash'

const NUM = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g

// round to 3 decimals (absorbs precision jitter), normalize -0, drop trailing zeros
function roundNum(m: string): string {
  let n = Math.round(parseFloat(m) * 1000) / 1000
  if (Object.is(n, -0)) n = 0
  return String(n)
}

// Canonicalize a geometry string: round numbers, space-out command letters,
// collapse all whitespace/commas — so encoding/formatting differences vanish.
function normGeom(s: string): string {
  return s
    .replace(NUM, roundNum)
    .replace(/([a-zA-Z])/g, ' $1 ')
    .replace(/[\s,]+/g, ' ')
    .trim()
}

const ELEM = /<(path|circle|ellipse|rect|line|polygon|polyline)\b([^>]*)>/gi
const ATTR = /([\w:-]+)\s*=\s*["']([^"']*)["']/g

// Parse an element's attributes once — cheaper than compiling a RegExp per lookup.
function parseAttrs(tagBody: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR.exec(tagBody))) attrs[m[1].toLowerCase()] = m[2]
  return attrs
}

function geomTokens(svg: string): string[] {
  const tokens: string[] = []
  ELEM.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ELEM.exec(svg))) {
    const t = m[1].toLowerCase()
    const a = parseAttrs(m[2])
    const g = (...names: string[]) => names.map((n) => a[n] || '').join(' ')
    if (t === 'path') tokens.push('P ' + normGeom(a.d || ''))
    else if (t === 'circle') tokens.push('C ' + normGeom(g('cx', 'cy', 'r')))
    else if (t === 'ellipse') tokens.push('E ' + normGeom(g('cx', 'cy', 'rx', 'ry')))
    else if (t === 'rect') tokens.push('R ' + normGeom(g('x', 'y', 'width', 'height', 'rx', 'ry')))
    else if (t === 'line') tokens.push('L ' + normGeom(g('x1', 'y1', 'x2', 'y2')))
    else tokens.push((t === 'polygon' ? 'PG ' : 'PL ') + normGeom(a.points || ''))
  }
  return tokens
}

// fill-rule + transform change the rendering, so they must affect the hash.
// Collected globally (handles fill-rule inherited from a <g>). fill-rule is
// deduped — declaring evenodd once vs on every path renders the same; transform
// stays occurrence-sensitive (position matters).
function modifiers(svg: string): string[] {
  const fillRules = new Set<string>()
  const transforms: string[] = []
  let m: RegExpExecArray | null
  const FR = /\bfill-rule\s*=\s*["']([^"']*)["']/gi
  while ((m = FR.exec(svg))) fillRules.add('fr:' + m[1].trim())
  const TR = /\btransform\s*=\s*["']([^"']*)["']/gi
  while ((m = TR.exec(svg))) transforms.push('tr:' + normGeom(m[1]))
  return [...fillRules, ...transforms].sort()
}

/** Geometry hash: same drawing (ignoring color/format/precision) → same hash. */
export function geomHash(svg: string): string {
  const geom = geomTokens(svg).sort()
  if (!geom.length) return '' // no geometry → never treated as a duplicate
  return fnv1a(geom.join('|') + '#' + modifiers(svg).join('|'))
}

export interface IconInput {
  id: string
  svg: string
}

export interface DuplicateGroup {
  hash: string
  /** distinct names that share identical geometry (length ≥ 2). */
  ids: string[]
}

/** Group icons by geometry; return only groups of ≥2 distinct names (duplicates). */
export function findDuplicates(icons: IconInput[]): DuplicateGroup[] {
  const byHash = new Map<string, string[]>()
  for (const { id, svg } of icons) {
    const h = geomHash(svg)
    if (!h) continue
    let arr = byHash.get(h)
    if (!arr) byHash.set(h, (arr = []))
    arr.push(id)
  }
  const groups: DuplicateGroup[] = []
  for (const [hash, names] of byHash) {
    const uniq = [...new Set(names)].sort()
    if (uniq.length >= 2) groups.push({ hash, ids: uniq })
  }
  return groups
}

/** Convenience: set of icon names that belong to any duplicate group (for badges). */
export function duplicateNames(icons: IconInput[]): Set<string> {
  const set = new Set<string>()
  for (const g of findDuplicates(icons)) for (const n of g.ids) set.add(n)
  return set
}
