import { FontAssetType, OtherAssetType, type RunnerOptions, generateFonts } from 'fantasticon'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { relative, join } from 'node:path'
import { emptyDirSync, ensureDirSync } from 'fs-extra'

import { IconData } from '../types'
import { SVG_TAG_REG, XML_TAG_REG } from './constants'
import { error } from './utils'

export function createFontsGenerator(root: string, clearCache: boolean, options: RunnerOptions) {
  const { inputDir, outputDir, name, descent, fontHeight = 300, round, prefix = 'icon' } = options
  let promise: Promise<IconData> | undefined

  /**
   * Forced re-run, ignore unfinished or completed promises
   * @param force
   */
  const run = (force?: boolean) => {
    if (promise && !force) return promise
    ensureDirSync(inputDir)
    ensureDirSync(outputDir)
    promise = new Promise<IconData>((resolve, reject) => {
      // Create output dir folder
      generateFonts({
        inputDir,
        outputDir,
        descent,
        fontHeight,
        round,
        name,
        prefix,
        templates: {},
        pathOptions: {},
        codepoints: {},
        normalize: true,
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
              absolutePath,
              svg: svgContent,
              svgBody: svgBody,
              relativePath: relative(root, absolutePath),
              lastModified: statSync(absolutePath).mtime
            }
          })
          iconifyConfig.icons = record

          writeFileSync(join(outputDir, 'iconify.json'), JSON.stringify(iconifyConfig, null, 2))
          resolve(data)
        })
        .catch((err) => {
          error(err.message || err)
        })
    })
    return promise
  }
  return { run }
}
