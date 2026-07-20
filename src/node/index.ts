import { type ResolvedConfig, type Plugin, ViteDevServer } from 'vite'
import c from 'picocolors'
import {
  NAME,
  isCI,
  CLIENT_URL,
  VIRTUAL_MODULE_ID,
  RESOLVED_VIRTUAL_MODULE_ID,
  // VIRTUAL_FONT_CSS_ID,
  // RESOLVED_VIRTUAL_FONT_CSS_ID,
  DEFAULT_FONT_NAME,
  DEFAULT_SPRITE_NAME,
  VIRTUAL_REGISTER_ID,
  RESOLVED_VIRTUAL_REGISTER_ID,
  DEFAULT_DTS
} from './constants'
import { debounce, colorUrl, openBrowser } from './utils'
import { Options } from './options'
import { buildIconMetas, generateBarrel, generateDts } from './importMode'
import sirv from 'sirv'
import { DIR_CLIENT } from '../dir'
import { resolve } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { createFontsGenerator } from './fontsGenerator'
import { createSpriteGenerator } from './spriteGenerator'
import { createRpcServer } from './rpc'
import { UpdatePayload, IconData } from '../types'
import { emptyDirSync } from 'fs-extra'
import { resolveAlias } from './alias'

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

// ── 虚拟模块的客户端代码生成 ──

// 运行时 fetch sprite 文本并注入。urlExpr 是 URL 的 JS 表达式源码
// (dev 用字符串字面量,build 用 import.meta.ROLLUP_FILE_URL_x)。
function spriteFetchSnippet(urlExpr: string): string {
  return `${SPRITE_INJECT_HELPER}\nfetch(${urlExpr}).then(function(r){return r.text()}).then(__supericonInject)`
}

// 把 sprite 内容内联进产物直接注入(class 模式 inject: 'inline')。
function spriteInlineSnippet(content: string): string {
  return `${SPRITE_INJECT_HELPER}\n__supericonInject(${JSON.stringify(content)})`
}

// class 模式:插入 <link> 加载 iconfont CSS。
function fontLinkSnippet(fontName: string): string {
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

export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    prefix = 'icon',
    font,
    svg,
    mode = 'class',
    dts = DEFAULT_DTS
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

  const spriteName = svg?.spriteName ?? DEFAULT_SPRITE_NAME
  const injectMode = svg?.inject ?? 'fetch'
  let svgDir: string | undefined
  let spriteGenerator: ReturnType<typeof createSpriteGenerator> | undefined

  const isImport = mode === 'import'
  let spriteRef: string | undefined // build 期 emitFile 资产引用 id

  async function buildMetasOrThrow() {
    const [fontList, svgList] = await Promise.all([
      fontsGenerator?.run() ?? Promise.resolve([] as IconData),
      spriteGenerator?.run() ?? Promise.resolve([] as IconData)
    ])
    const { metas, conflicts } = buildIconMetas([...fontList, ...svgList])
    if (conflicts.length) {
      const msg = conflicts
        .map((conflict) =>
          conflict.reason === 'duplicate'
            ? `导出名冲突 "${conflict.exportName}":${conflict.paths.join(
                ' ↔ '
              )}(import 模式下图标名须跨目录全局唯一)`
            : `非法图标名(无法生成标识符):${conflict.paths.join(', ')}`
        )
        .join('\n')
      throw new Error(`[${NAME}] import 模式命名冲突:\n${msg}`)
    }
    if (dts !== false) {
      writeFileSync(resolve(root, dts), generateDts(metas))
    }
    return metas
  }

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
      const dtsPath = dts === false ? undefined : resolve(root, dts)
      for (const d of [fontSourceDir, svgDir]) if (d) server.watcher.add(d)
      const onChange = (file: string) => {
        // 忽略插件自己写出的 .d.ts:它在项目根(被 Vite 监听),否则写 dts→触发 change→再写 dts,无限刷新
        if (dtsPath && resolve(file) === dtsPath) return
        regenerate(true)
        if (isImport) {
          // 重建 metas(刷新 .d.ts;命名冲突报到终端),失效虚拟模块 + 整页刷新
          buildMetasOrThrow().catch((err) => console.error(c.red(err?.message || err)))
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
      server.watcher.on('change', onChange)
    }

    // Persist an icon SVG edited in the preview UI (e.g. one-click repair).
    // Writing the file triggers the watcher → regenerate → update push.
    server.ws.on(`${NAME}:save`, (data: { absolutePath: string; svg: string }) => {
      try {
        const target = resolve(data.absolutePath)
        const allowed = [fontSourceDir, svgDir].filter(Boolean) as string[]
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

      if (clearCache) {
        emptyDirSync(distDir)
      }

      if (font) {
        const alias = viteConfig.resolve?.alias
        // alias resolve
        // eg: dir: '@/xxxx'
        fontSourceDir = alias ? resolveAlias(font.dir, alias, root) : resolve(root, font.dir)
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
        const alias = viteConfig.resolve?.alias
        svgDir = alias ? resolveAlias(svg.dir, alias, root) : resolve(root, svg.dir)
        spriteGenerator = createSpriteGenerator(root, {
          svgDir,
          outputDir: distDir,
          prefix,
          spriteName,
          svgo: svg.svgo
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
      if (id === VIRTUAL_REGISTER_ID) return RESOLVED_VIRTUAL_REGISTER_ID
    },
    async load(id) {
      // ── import 模式 ──
      if (isImport) {
        // 组件 barrel:可摇除
        if (id === RESOLVED_VIRTUAL_MODULE_ID) {
          const metas = await buildMetasOrThrow()
          return { code: generateBarrel(metas), moduleSideEffects: false }
        }
        // register:副作用初始化(加载 font.css + svg sprite)
        if (id === RESOLVED_VIRTUAL_REGISTER_ID) {
          await Promise.all([fontsGenerator?.run(), spriteGenerator?.run()])
          const lines: string[] = []
          if (fontsGenerator) lines.push(fontLinkSnippet(fontName))
          if (spriteGenerator) {
            if (isDev) {
              const spriteUrl = `/@fs/${distDir}/${spriteName}.svg`
              lines.push(spriteFetchSnippet(JSON.stringify(spriteUrl)))
            } else {
              // build:emit 资产用显式 fileName(令 ROLLUP_FILE_URL 在渲染期即可解析),
              // source 占位,裁剪后的内容在 generateBundle 覆写。
              spriteRef = this.emitFile({
                type: 'asset',
                fileName: `${spriteName}.svg`,
                source: ''
              })
              lines.push(spriteFetchSnippet(`import.meta.ROLLUP_FILE_URL_${spriteRef}`))
            }
          }
          return lines.join('\n')
        }
        return
      }

      // ── class 模式(现状,保持不变):JS 模块 = 引入 font CSS + 注入 sprite ──
      if (id === RESOLVED_VIRTUAL_REGISTER_ID) {
        const lines: string[] = []
        if (fontsGenerator) {
          await fontsGenerator.run()
          lines.push(fontLinkSnippet(fontName))
        }
        if (spriteGenerator) {
          await spriteGenerator.run()
          const spriteFile = `${distDir}/${spriteName}.svg`
          if (injectMode === 'inline') {
            lines.push(spriteInlineSnippet(readFileSync(spriteFile, 'utf8')))
          } else {
            lines.push(spriteFetchSnippet(JSON.stringify(`/@fs/${spriteFile}`)))
          }
        }
        return lines.join('\n')
      }
    },
    generateBundle(_outputOptions, bundle) {
      if (!isImport || !spriteGenerator || spriteRef == null) return
      const symbols = spriteGenerator.getSymbols()
      const used = new Set<string>()
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        for (const useId of symbols.keys()) {
          if (file.code.includes('#' + useId)) used.add(useId)
        }
      }
      const body = [...used].map((useId) => symbols.get(useId) ?? '').join('')
      const sprite =
        `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ` +
        `style="position:absolute;width:0;height:0;overflow:hidden">` +
        body +
        `</svg>`
      const asset = bundle[`${spriteName}.svg`]
      if (asset && asset.type === 'asset') asset.source = sprite
    }
  }
}
