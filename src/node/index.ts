import { type ResolvedConfig, type Plugin, ViteDevServer } from 'vite'
import c from 'picocolors'
import {
  NAME,
  isCI,
  CLIENT_URL,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  VIRTUAL_FONT_CSS_ID,
  RESOLVED_VIRTUAL_FONT_CSS_ID,
  DEFAULT_FONT_NAME,
  DEFAULT_SPRITE_NAME
} from './constants'
import { debounce, colorUrl, openBrowser } from './utils'
import { Options } from './options'
import sirv from 'sirv'
import { DIR_CLIENT } from '../dir'
import { resolve } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { createFontsGenerator } from './fontsGenerator'
import { createSpriteGenerator } from './spriteGenerator'
import { createRpcServer } from './rpc'
import { UpdatePayload, IconData } from '../types'
import { emptyDirSync } from 'fs-extra'

// 注入到用户页面的幂等帮助函数(以源码字符串形式打进虚拟模块)。
const SPRITE_INJECT_HELPER = `function __supericonInject(txt){
  if (typeof document === 'undefined') return;
  if (document.getElementById('__supericon_sprite')) return;
  var tpl = document.createElement('template');
  tpl.innerHTML = String(txt).trim();
  var svg = tpl.content.firstElementChild;
  if (!svg || svg.tagName.toLowerCase() !== 'svg') return;
  svg.id = '__supericon_sprite';
  svg.setAttribute('aria-hidden','true');
  svg.style.position='absolute'; svg.style.width='0'; svg.style.height='0'; svg.style.overflow='hidden';
  document.body.prepend(svg);
}`

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

  const spriteName = svg?.spriteName ?? DEFAULT_SPRITE_NAME
  const injectMode = svg?.inject ?? 'fetch'
  let svgDir: string | undefined
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
          cssPath: `${distDir}/${fontName}.css`,
          spritePath: svgDir ? `${distDir}/${spriteName}.svg` : undefined
        })
      })
    }, 500)

    if (watch) {
      for (const d of [fontDir, svgDir]) if (d) server.watcher.add(d)
      const onChange = () => regenerate(true)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('change', onChange)
    }

    // Persist an icon SVG edited in the preview UI (e.g. one-click repair).
    // Writing the file triggers the watcher → regenerate → update push.
    server.ws.on(`${NAME}:save`, (data: { absolutePath: string; svg: string }) => {
      try {
        const target = resolve(data.absolutePath)
        const allowed = [fontDir, svgDir].filter(Boolean) as string[]
        if (!allowed.some((d) => target.startsWith(d))) {
          console.warn(c.yellow(`[${NAME}] refused to write outside src dirs: ${target}`))
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

      if (svg) {
        svgDir = resolveDir(svg.dir)
        spriteGenerator = createSpriteGenerator(root, {
          svgDir,
          outputDir: distDir,
          prefix,
          spriteName
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
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
      if (id === VIRTUAL_FONT_CSS_ID) return RESOLVED_VIRTUAL_FONT_CSS_ID
    },
    async load(id) {
      // 内部嵌套:font CSS(保持原 @import 逻辑,走 Vite CSS 管线)
      if (id === RESOLVED_VIRTUAL_FONT_CSS_ID) {
        await fontsGenerator?.run()
        return `@import './node_modules/.supericon/${fontName}.css'`
      }
      // 统一入口:JS 模块 = 引入 font CSS + 注入 sprite
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const lines: string[] = []
        if (fontsGenerator) {
          await fontsGenerator.run()
          lines.push(`import ${JSON.stringify(VIRTUAL_FONT_CSS_ID)}`)
        }
        if (spriteGenerator) {
          await spriteGenerator.run()
          const spriteFile = `${distDir}/${spriteName}.svg`
          if (injectMode === 'inline') {
            const content = readFileSync(spriteFile, 'utf8')
            lines.push(`${SPRITE_INJECT_HELPER}\n__supericonInject(${JSON.stringify(content)})`)
          } else {
            const spriteUrl = `/@fs/${spriteFile}`
            lines.push(
              `${SPRITE_INJECT_HELPER}\n` +
                `fetch(${JSON.stringify(spriteUrl)}).then(function(r){return r.text()}).then(__supericonInject)`
            )
          }
        }
        return lines.join('\n')
      }
    }
  }
}
