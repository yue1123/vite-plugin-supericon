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
    name = DEFAULT_FONT_NAME,
    srcDir: _srcDir,
    ...fontOptions
  } = options || {}
  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  let distDir = resolve(root, './node_modules/.supericon')

  let srcDir: string
  let fontsGenerator: ReturnType<typeof createFontsGenerator>

  function configureServer(server: ViteDevServer) {
    const base = (options.base ?? server.config.base) || '/'
    const rpcServer = createRpcServer<{
      update: UpdatePayload
    }>(server.ws)

    const regenerateFont = debounce((force: boolean = true) => {
      fontsGenerator.run(force).then((data) => {
        rpcServer.send('update', {
          name,
          iconList: data,
          cssPath: `${distDir}/${name}.css`
        })
      })
    }, 500)

    if (watch) {
      server.watcher.add(srcDir)
      server.watcher.on('add', () => regenerateFont(true))
      server.watcher.on('unlink', () => regenerateFont(true))
      server.watcher.on('change', () => regenerateFont(true))
    }

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
    config(config, { command }) {
      isDev = command === 'serve'

      let isResolved = false
      if (config.resolve && config.resolve.alias) {
        const { alias } = config.resolve
        const aliasKeys = Object.keys(alias)
        debugger
        isResolved = aliasKeys.some((aliasKey) => {
          if (_srcDir.includes(aliasKey)) {
            // @ts-ignore
            srcDir = _srcDir.replace(aliasKey, alias[aliasKey])
            return true
          }
        })
      }
      if (!isResolved) {
        srcDir = resolve(root, _srcDir)
      }
      if (clearCache) {
        emptyDirSync(distDir)
      }
      fontsGenerator = createFontsGenerator(root, clearCache, {
        inputDir: srcDir,
        outputDir: distDir,
        name,
        ...fontOptions
      })
    },
    configResolved(_config) {
      config = _config
    },
    configureServer(ser) {
      isDev && configureServer(ser)
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        await fontsGenerator.run()
        return `@import './node_modules/.supericon/${DEFAULT_FONT_NAME}.css'`
      }
    }
  }
}
