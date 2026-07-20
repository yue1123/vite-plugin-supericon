import { ensureDirSync, type Stats } from 'fs-extra'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { optimize, type Config as SvgoConfig } from 'svgo'

import { IconData, IconDataItem } from '../types'
import { error, warn } from './utils'
import { getTagsFromPath } from './fontsGenerator'

export interface SpriteGeneratorOptions {
  svgDir: string
  outputDir: string
  prefix: string
  spriteName: string
  /** svgo 优化:true=默认优化(保留 viewBox),false=仅归一化,Config=自定义。@default true */
  svgo?: boolean | SvgoConfig
}

/** root <svg> 上需要丢弃的属性(viewBox 单独显式处理) */
const DROP_ATTRS = new Set(['width', 'height', 'xmlns', 'xmlns:xlink', 'x', 'y', 'id', 'viewBox'])

/**
 * 把若干 <symbol> 包进隐藏的 sprite 根 <svg>。
 * dev(spriteGenerator 写盘)与 build(index.ts generateBundle 覆写)共用同一份包装,
 * 避免改容器样式时两端静默分歧。
 */
export function wrapSprite(body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
    `style="position:absolute;width:0;height:0;overflow:hidden">` +
    body +
    `</svg>`
  )
}

/** 手写递归(兼容 Node >=14,不用 readdirSync 的 recursive 选项)。 */
function walkSvgFiles(dir: string): string[] {
  const out: string[] = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkSvgFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.svg')) out.push(full)
  }
  return out
}

/** 解析根标签属性串(svgo 归一化后属性均为双引号,正则安全)。 */
function parseRootAttrs(attrsStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrsStr))) attrs[m[1]] = m[2]
  return attrs
}

/**
 * 组装最终 svgo 配置:按 svg.svgo 选优化插件,并按需注入按 symbol 命名空间化内部 id 的 prefixIds。
 * - false → 不做优化插件(svgo 仅归一化)
 * - true / undefined → preset-default(保留 viewBox)
 * - Config → 透传用户配置(plugins 缺省时回退到保留 viewBox 的 preset-default)
 */
function buildSvgoConfig(svgo: boolean | SvgoConfig | undefined, symbolId: string): SvgoConfig {
  const presetDefault = { name: 'preset-default', params: { overrides: { removeViewBox: false } } }
  let extra: Record<string, unknown> = {}
  let plugins: any[]
  if (svgo === false) {
    plugins = []
  } else if (svgo === true || svgo == null) {
    plugins = [presetDefault]
  } else {
    const { plugins: userPlugins, ...rest } = svgo
    extra = rest as Record<string, unknown>
    plugins = [...((userPlugins as any[]) ?? [presetDefault])]
  }
  const hasPrefix = plugins.some((p) =>
    typeof p === 'string' ? p === 'prefixIds' : p?.name === 'prefixIds'
  )
  if (!hasPrefix) plugins.push({ name: 'prefixIds', params: { prefix: symbolId } })
  return { ...extra, plugins }
}

/**
 * 在 svgo 归一化输出上把根 <svg> 包装成 <symbol>。
 * 根不是 svg → 返回 null(调用方 warn 跳过)。
 */
function wrapAsSymbol(
  optimized: string,
  symbolId: string,
  onMissingViewBox: () => void
): { symbol: string; body: string; viewBox: string } | null {
  const open = optimized.match(/<svg\b([^>]*)>/i)
  if (!open || open.index == null) return null
  const attrs = parseRootAttrs(open[1])

  let viewBox = attrs.viewBox
  if (!viewBox) {
    const w = parseFloat(attrs.width)
    const h = parseFloat(attrs.height)
    if (w > 0 && h > 0) viewBox = `0 0 ${w} ${h}`
  }
  if (!viewBox) {
    onMissingViewBox()
    viewBox = '0 0 24 24'
  }

  const kept = Object.keys(attrs)
    .filter((k) => !DROP_ATTRS.has(k))
    .map((k) => ` ${k}="${attrs[k]}"`)
    .join('')

  const start = open.index + open[0].length
  const body = optimized.slice(start).replace(/<\/svg>\s*$/i, '')
  const symbol = `<symbol id="${symbolId}" viewBox="${viewBox}"${kept}>${body}</symbol>`
  return { symbol, body, viewBox }
}

export function createSpriteGenerator(root: string, options: SpriteGeneratorOptions) {
  const { svgDir, outputDir, prefix, spriteName, svgo } = options
  const cache = new Map<string, { mtimeMs: number; symbol: string; item: IconDataItem }>()
  let lastSymbols = new Map<string, string>()
  let promise: Promise<IconData> | undefined

  function buildOne(
    absolutePath: string,
    stat: Stats
  ): { symbol: string; item: IconDataItem } | null {
    const rel = relative(root, absolutePath)
    const decoded = readFileSync(absolutePath).toString('utf8')
    const raw = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded
    if (!/<svg[\s>]/i.test(raw)) {
      warn(`not an svg, skipped ${rel}`)
      return null
    }
    const id = basename(absolutePath, '.svg')
    const useId = `${prefix}-${id}`

    let optimized: string
    try {
      optimized = optimize(raw, buildSvgoConfig(svgo, useId)).data
    } catch (err: any) {
      warn(`svgo optimize failed for ${rel}: ${err?.message || err}`)
      return null
    }

    const wrapped = wrapAsSymbol(optimized, useId, () =>
      warn(`missing viewBox/size, fell back to "0 0 24 24": ${rel}`)
    )
    if (!wrapped) {
      warn(`root is not <svg>, skipped ${rel}`)
      return null
    }

    const item: IconDataItem = {
      id,
      useId,
      format: 'svg',
      absolutePath,
      svg: raw,
      svgBody: wrapped.body,
      relativePath: rel,
      lastModified: stat.mtime,
      tags: getTagsFromPath(svgDir, absolutePath)
    }
    return { symbol: wrapped.symbol, item }
  }

  const run = (force?: boolean): Promise<IconData> => {
    if (promise && !force) return promise
    ensureDirSync(svgDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve) => {
      try {
        const files = walkSvgFiles(svgDir).sort()
        const present = new Set(files)
        for (const key of [...cache.keys()]) if (!present.has(key)) cache.delete(key)

        const symbols: string[] = []
        const data: IconData = []
        const seen = new Set<string>()
        const nextSymbols = new Map<string, string>()

        for (const absolutePath of files) {
          const stat = statSync(absolutePath)
          let entry = cache.get(absolutePath)
          if (!entry || entry.mtimeMs !== stat.mtimeMs) {
            const built = buildOne(absolutePath, stat)
            if (!built) continue
            entry = { mtimeMs: stat.mtimeMs, symbol: built.symbol, item: built.item }
            cache.set(absolutePath, entry)
          }
          if (seen.has(entry.item.useId)) {
            warn(`duplicate symbol id "${entry.item.useId}", skipped ${entry.item.relativePath}`)
            continue
          }
          seen.add(entry.item.useId)
          symbols.push(entry.symbol)
          data.push(entry.item)
          nextSymbols.set(entry.item.useId, entry.symbol)
        }
        lastSymbols = nextSymbols

        writeFileSync(join(outputDir, `${spriteName}.svg`), wrapSprite(symbols.join('')))
        resolve(data)
      } catch (err: any) {
        error(err?.message || err)
        resolve([])
      }
    })
    return promise
  }

  return { run, getSymbols: () => lastSymbols }
}
