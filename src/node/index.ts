import { type ResolvedConfig, type Plugin, ViteDevServer } from 'vite'
import c from 'picocolors'
import {
  NAME,
  isCI,
  CLIENT_URL,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  DEFAULT_FONT_NAME
} from './constants'
import { debounce, colorUrl, openBrowser } from './utils'
import { Options } from './options'
import sirv from 'sirv'
import { DIR_CLIENT } from '../dir'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { createFontsGenerator } from './fontsGenerator'
import { createRpcServer } from './rpc'
import { UpdatePayload } from '../types'
import { emptyDirSync } from 'fs-extra'

export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    prefix = 'icon',
    font: _font,
    svg,
    srcDir: _legacySrcDir,
    name: _legacyName
  } = options || {}

  // 弃用 shim:顶层 srcDir/name → font 轨
  let font = _font
  if (!font && _legacySrcDir) {
    console.warn(
      c.yellow(`[${NAME}] 顶层 \`srcDir\`/\`name\` 已弃用,请改用 \`font: { dir, name }\``)
    )
    font = { dir: _legacySrcDir, name: _legacyName }
  }
  if (!font && !svg) {
    throw new Error(`[${NAME}] 需至少配置 \`font\` 或 \`svg\` 之一`)
  }

  const fontName = font?.name ?? DEFAULT_FONT_NAME

  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  const distDir = resolve(root, './node_modules/.supericon')

  let fontDir: string | undefined
  let fontsGenerator: ReturnType<typeof createFontsGenerator> | undefined

  function configureServer(server: ViteDevServer) {
    const base = (options.base ?? server.config.base) || '/'
    const rpcServer = createRpcServer<{
      update: UpdatePayload
    }>(server.ws)

    const regenerateFont = debounce((force: boolean = true) => {
      ;(fontsGenerator?.run(force) ?? Promise.resolve([])).then((data) => {
        rpcServer.send('update', {
          name: fontName,
          iconList: data,
          cssPath: `${distDir}/${fontName}.css`
        })
      })
    }, 500)

    if (watch && fontDir) {
      server.watcher.add(fontDir)
      server.watcher.on('add', () => regenerateFont(true))
      server.watcher.on('unlink', () => regenerateFont(true))
      server.watcher.on('change', () => regenerateFont(true))
    }

    // Persist an icon SVG edited in the preview UI (e.g. one-click repair).
    // Writing the file triggers the watcher → regenerateFont → update push.
    server.ws.on(`${NAME}:save`, (data: { absolutePath: string; svg: string }) => {
      try {
        const target = resolve(data.absolutePath)
        if (!fontDir || !target.startsWith(fontDir)) {
          console.warn(c.yellow(`[${NAME}] refused to write outside srcDir: ${target}`))
          return
        }
        writeFileSync(target, data.svg, 'utf8')
      } catch (err: any) {
        console.error(c.red(`[${NAME}] save failed: ${err?.message || err}`))
      }
    })

    server.middlewares.use(
      `${base}${CLIENT_URL}`,
      sirv(DIR_CLIENT, {
        single: true,
        dev: true
      })
    )
    server.ws.on('connection', () => {
      regenerateFont(false)
    })

    // print url in terminal
    const _print = server.printUrls
    server.printUrls = () => {
      let host = `${config.server.https ? 'https' : 'http'}://localhost:${
        config.server.port || '80'
      }`

      const url = server.resolvedUrls?.local[0]
      const base = server.config.base || '/'
      if (url) {
        try {
          const u = new URL(url)
          host = `${u.protocol}//${u.host}`
        } catch (error) {
          console.warn('Parse resolved url failed:', error)
        }
      }
      _print()
      const clientUrl = `${host}${base}${CLIENT_URL}/`
      if (!silent) {
        console.log(`  ${c.green('➜')}  ${c.bold('SuperIcon')}: ${colorUrl(clientUrl)}`)
      }

      if (_open && !isCI) {
        // a delay is added to ensure the app page is opened first
        setTimeout(() => openBrowser(clientUrl), 500)
      }
    }
  }

  return {
    name: NAME,
    enforce: 'pre',
    config(viteConfig, { command }) {
      isDev = command === 'serve'

      const resolveDir = (dir: string): string => {
        const alias = viteConfig.resolve?.alias
        if (alias && !Array.isArray(alias)) {
          for (const key of Object.keys(alias)) {
            if (dir.includes(key)) {
              // @ts-ignore alias 值类型可能为 string
              return dir.replace(key, alias[key])
            }
          }
        }
        return resolve(root, dir)
      }

      if (clearCache) {
        emptyDirSync(distDir)
      }

      if (font) {
        fontDir = resolveDir(font.dir)
        fontsGenerator = createFontsGenerator(root, {
          srcDir: fontDir,
          outputDir: distDir,
          name: fontName,
          prefix,
          descent: font.descent,
          fontHeight: font.fontHeight,
          round: font.round,
          normalize: font.normalize,
          tag: font.tag,
          selector: font.selector,
          cssTemplate: font.cssTemplate
        })
      }
    },
    configResolved(_config) {
      config = _config
    },
    configureServer(ser) {
      if (isDev) {
        configureServer(ser)
      }
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }
    }
  }
}
