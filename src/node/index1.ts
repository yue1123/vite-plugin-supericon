import { ResolvedConfig, ViteDevServer, type Plugin } from 'vite'
import {
  NAME,
  DEFAULT_FONT_NAME,
  DEFAULT_DTS,
  CLIENT_URL,
  isCI,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  // VIRTUAL_FONT_CSS_ID,
  // RESOLVED_VIRTUAL_FONT_CSS_ID,
  VIRTUAL_REGISTER_ID,
  RESOLVED_VIRTUAL_REGISTER_ID
  // DEFAULT_SPRITE_NAME,
} from './constants'
import { Options } from './options'
import { resolve } from 'node:path'
import { createFontsGenerator } from './fontsGenerator'
// import { createSpriteGenerator } from './spriteGenerator'
import c from 'picocolors'
import { emptyDirSync } from 'fs-extra'
import { writeFileSync } from 'node:fs'
import { resolveAlias } from './alias'
import { createRpcServer } from './rpc'
import { IconData, UpdatePayload } from '../types'
import { colorUrl, debounce, error, openBrowser, warn } from './utils'
import { createSpriteGenerator } from './spriteGenerator'
import { DIR_CLIENT } from '../dir'
import sirv from 'sirv'

export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    clearCache = true,
    silent = false,
    watch = true,
    mode = 'class',
    dts = DEFAULT_DTS,
    prefix = 'icon',
    font,
    svg
  } = options || {}

  if (!font && !svg) {
    throw new Error(`[${NAME}] At least one of \`font\` or \`svg\` must be configured`)
  }

  const fontName = font?.name ?? DEFAULT_FONT_NAME

  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  const distDir = resolve(root, './node_modules/.supericon')

  let fontSourceDir: string | undefined
  let fontsGenerator: ReturnType<typeof createFontsGenerator> | undefined

  // const spriteName = svg?.spriteName ?? DEFAULT_SPRITE_NAME
  let svgSourceDir: string | undefined
  let spriteGenerator: ReturnType<typeof createSpriteGenerator> | undefined

  function configureServer(server: ViteDevServer) {
    const base = (options.base ?? server.config.base) || '/'
    const rpcServer = createRpcServer<{
      update: UpdatePayload
    }>(server.ws)

    const regenerate = debounce((force: boolean = true) => {
      Promise.all([
        fontsGenerator?.run(force) ?? Promise.resolve([] as IconData),
        spriteGenerator?.run(force) ?? Promise.resolve([] as IconData)
      ]).then(([fontList, svgList]) => {
        rpcServer.send('update', {
          name: fontName,
          iconList: [...fontList, ...svgList],
          cssPath: `${distDir}/${fontName}.css`
          // spritePath: svgDir ? `${distDir}/${spriteName}.svg` : undefined
        })
      })
    }, 500)

    if (watch) {
      for (const d of [fontSourceDir, svgSourceDir]) if (d) server.watcher.add(d)
      const onChange = () => {
        regenerate(true)
        // if (isImport) {
        //   // 重建 metas(刷新 .d.ts;命名冲突报到终端),失效虚拟模块 + 整页刷新
        //   buildMetasOrThrow().catch((err) => console.error(c.red(err?.message || err)))
        //   const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        //   if (mod) server.moduleGraph.invalidateModule(mod)
        //   server.ws.send({ type: 'full-reload' })
        // }
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('change', onChange)
    }

    server.ws.on(`${NAME}:save`, (data: { absolutePath: string; svg: string }) => {
      try {
        const target = resolve(data.absolutePath)
        const allowed = [fontSourceDir, svgSourceDir].filter(Boolean) as string[]
        if (!allowed.some((d) => target.startsWith(d))) {
          warn(`refused to write outside src dirs: ${target}`)
          return
        }
        writeFileSync(target, data.svg, 'utf8')
      } catch (err: any) {
        error(`save failed: ${err?.message || err}`)
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
      regenerate(false)
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

  const plugin = <Plugin>{
    name: NAME,
    enforce: 'pre',
    config(viteConfig, { command }) {
      isDev = command === 'serve'

      console.log(viteConfig.resolve?.alias)

      if (clearCache) {
        emptyDirSync(distDir)
      }

      if (font) {
        const { resolve = {} } = viteConfig
        // alias resolve
        // eg: dir: '@/xxxx'
        fontSourceDir = resolve.alias ? resolveAlias(font.dir, resolve.alias, root) : font.dir

        fontsGenerator = createFontsGenerator(root, {
          srcDir: fontSourceDir,
          outputDir: distDir,
          name: fontName,
          prefix,
          descent: font.descent,
          fontHeight: font.fontHeight,
          round: font.round,
          normalize: font.normalize,
          tag: font.tag,
          selector: font.selector
        })
      }

      if (svg) {
        // svgDir = resolveDir(svg.dir)
        // spriteGenerator = createSpriteGenerator(root, {
        //   svgDir,
        //   outputDir: distDir,
        //   prefix,
        //   spriteName,
        //   svgo: svg.svgo
        // })
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
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
      if (id === VIRTUAL_REGISTER_ID) return RESOLVED_VIRTUAL_REGISTER_ID
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_REGISTER_ID) {
        if (fontsGenerator) {
          await fontsGenerator.run()
          return `
          const link = document.createElement('link')
          link.id = 'supericon'
          link.rel = 'stylesheet'
          link.href = './node_modules/.supericon/${fontName}.css?v=${Date.now()}'
          link.onload = () => {
            try {
              if (!link.sheet || link.sheet.cssRules.length === 0) {
                console.error('[vite-plugin-supericon] iconfont css load error')
              }
            } catch (e) {
             //
            }
          }
          document.head.append(link)
          `
        }
      }
    }
  }

  return plugin
}
