import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { ensureDirSync } from 'fs-extra'

import { IconData } from '../types'
import { SVG_TAG_REG, XML_TAG_REG, SVG_VIEWBOX_REG } from './constants'
import { error } from './utils'
import { getTagsFromPath } from './fontsGenerator'

export interface SpriteGeneratorOptions {
  svgDir: string
  outputDir: string
  prefix: string
  spriteName: string
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

export function createSpriteGenerator(root: string, options: SpriteGeneratorOptions) {
  const { svgDir, outputDir, prefix, spriteName } = options
  let promise: Promise<IconData> | undefined

  const run = (force?: boolean): Promise<IconData> => {
    if (promise && !force) return promise
    ensureDirSync(svgDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve) => {
      try {
        const files = walkSvgFiles(svgDir)
        const symbols: string[] = []
        const data: IconData = files.map((absolutePath) => {
          const svgContent = readFileSync(absolutePath).toString()
          const id = basename(absolutePath, '.svg')
          const useId = `${prefix}-${id}`
          const viewBox = svgContent.match(SVG_VIEWBOX_REG)?.[1]?.trim() || '0 0 24 24'
          const svgBody = svgContent
            .replace(SVG_TAG_REG, '')
            .replace(XML_TAG_REG, '')
            .replace(/\n/g, '')
            .trim()
          symbols.push(`<symbol id="${useId}" viewBox="${viewBox}">${svgBody}</symbol>`)
          return {
            id,
            useId,
            format: 'svg' as const,
            absolutePath,
            svg: svgContent,
            svgBody,
            viewBox,
            relativePath: relative(root, absolutePath),
            lastModified: statSync(absolutePath).mtime,
            tags: getTagsFromPath(svgDir, absolutePath)
          }
        })

        const sprite =
          `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
          `style="position:absolute;width:0;height:0;overflow:hidden">` +
          symbols.join('') +
          `</svg>`
        writeFileSync(join(outputDir, `${spriteName}.svg`), sprite)
        resolve(data)
      } catch (err: any) {
        error(err?.message || err)
        resolve([])
      }
    })
    return promise
  }

  return { run }
}
