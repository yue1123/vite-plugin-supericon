import { FontAssetType, OtherAssetType, generateFonts } from '@twbs/fantasticon'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { relative, join, dirname } from 'node:path'
import { ensureDirSync } from 'fs-extra'

import { IconData } from '../types'
import { SVG_TAG_REG, XML_TAG_REG, SVG_VIEWBOX_REG } from './constants'
import { error } from './utils'

/**
 * 取文件相对 srcDir 的目录部分，按每层目录切成标签数组。
 * 根级文件（直接位于 srcDir 下）返回 []；同时兼容 Windows 反斜杠路径。
 */
export function getTagsFromPath(srcDir: string, absolutePath: string): string[] {
  const dir = dirname(relative(srcDir, absolutePath))
  if (dir === '.' || dir === '' || dir.startsWith('..')) return []
  return dir.split(/[\\/]/).filter(Boolean)
}

export interface FontGeneratorRunnerOptions {
  srcDir: string
  outputDir: string
  name: string
  prefix: string
  descent?: number
  fontHeight?: number
  round?: number
  normalize?: boolean
  tag?: string
  selector?: string
  cssTemplate?: string
}

export function createFontsGenerator(root: string, options: FontGeneratorRunnerOptions) {
  const {
    srcDir,
    outputDir,
    name,
    descent,
    fontHeight = 300,
    round,
    normalize = true,
    prefix = 'icon',
    tag = 'i',
    cssTemplate
  } = options
  let promise: Promise<IconData> | undefined

  /**
   * Forced re-run, ignore unfinished or completed promises
   * @param force
   */
  const run = (force?: boolean) => {
    if (promise && !force) return promise
    ensureDirSync(srcDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve) => {
      generateFonts({
        inputDir: srcDir,
        outputDir,
        descent,
        fontHeight,
        round,
        name,
        prefix,
        tag,
        normalize,
        templates: {
          css: cssTemplate
        },
        fontTypes: [FontAssetType.EOT, FontAssetType.WOFF2, FontAssetType.WOFF],
        assetTypes: [
          OtherAssetType.CSS
          // , OtherAssetType.TS
        ]
      })
        .then((result) => {
          const assets = result.assetsIn
          const record: Record<string, { body: string }> = {}
          const iconifyConfig = {
            prefix,
            icons: {},
            lastModified: Date.now(),
            width: 24,
            height: 24
          }

          const data = Object.values(assets).map(({ absolutePath, id }) => {
            const svgContent = readFileSync(absolutePath).toString()
            const svgBody = svgContent
              .replace(SVG_TAG_REG, '')
              .replace(XML_TAG_REG, '')
              .replace('\n', '')
              .trim()

            record[id] = {
              body: svgBody
            }

            return {
              id,
              useId: `${prefix}-${id}`,
              format: 'font' as const,
              absolutePath,
              svg: svgContent,
              svgBody: svgBody,
              viewBox: svgContent.match(SVG_VIEWBOX_REG)?.[1]?.trim() || '0 0 24 24',
              relativePath: relative(root, absolutePath),
              lastModified: statSync(absolutePath).mtime,
              tags: getTagsFromPath(srcDir, absolutePath)
            }
          })
          iconifyConfig.icons = record

          writeFileSync(join(outputDir, 'iconify.json'), JSON.stringify(iconifyConfig, null, 2))
          resolve(data)
        })
        .catch((err) => {
          error(err.message || err)
          resolve([])
        })
    })
    return promise
  }
  return { run }
}
