import { type ResolvedConfig, type Plugin, ViteDevServer, normalizePath, type Rollup } from 'vite'
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
import { resolve, sep } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { createFontsGenerator } from './fontsGenerator'
import { createSpriteGenerator, wrapSprite } from './spriteGenerator'
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

// 插入 <link> 加载 iconfont CSS。urlExpr 是 href 的 JS 表达式源码
// (dev 用 /@fs 字符串字面量,build 用 import.meta.ROLLUP_FILE_URL_x)。
function fontLinkSnippet(urlExpr: string): string {
  return `
          const link = document.createElement('link')
          link.id = 'supericon'
          link.rel = 'stylesheet'
          link.href = ${urlExpr}
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

// build:把 iconfont.css 及其字体文件作为 Vite 资产 emit(显式 fileName 令 CSS 内部
// 相对 url('./x.woff2') 仍可解析),返回 css 资产的 ROLLUP_FILE_URL 引用 id。
function emitFontAssets(ctx: Rollup.PluginContext, distDir: string, fontName: string): string {
  for (const ext of ['eot', 'woff2', 'woff']) {
    const file = resolve(distDir, `${fontName}.${ext}`)
    try {
      ctx.emitFile({ type: 'asset', fileName: `${fontName}.${ext}`, source: readFileSync(file) })
    } catch {
      // 字体类型缺失(理论上不会发生)时跳过,由 CSS 中对应 @font-face src 自然降级。
    }
  }
  return ctx.emitFile({
    type: 'asset',
    fileName: `${fontName}.css`,
    source: readFileSync(resolve(distDir, `${fontName}.css`), 'utf8')
  })
}

export function superIcon(options: Options): Plugin {
  const {
    open: _open = false,
    silent = false,
    watch = true,
    clearCache = true,
    prefix = 'icon',
    svg,
    mode = 'class',
    dts = DEFAULT_DTS
  } = options || {}

  // 向后兼容:顶层 srcDir/name(deprecated)映射到 font 轨,启动时一次性告警。
  let font = options?.font
  if (!font && options?.srcDir) {
    console.warn(
      c.yellow(
        `[${NAME}] \`srcDir\`/\`name\` 已废弃,请改用 \`font: { dir, name }\`;本次已自动兼容。`
      )
    )
    font = { dir: options.srcDir, name: options.name }
  }

  if (!font && !svg) {
    throw new Error(`[${NAME}] At least one of \`font\` or \`svg\` must be configured`)
  }

  const fontName = font?.name ?? DEFAULT_FONT_NAME

  const root = process.cwd()
  let config: ResolvedConfig
  let isDev: boolean
  const distDir = resolve(root, './node_modules/.supericon')
  // dev 下 /@fs 需要正斜杠路径(Windows 上 resolve 产出反斜杠)。
  const fsDistDir = normalizePath(distDir)

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

    const sendUpdate = (fontList: IconData, svgList: IconData) => {
      rpcServer.send('update', {
        name: fontName,
        iconList: [...fontList, ...svgList],
        cssPath: `${distDir}/${fontName}.css`,
        spritePath: svgDir ? `${distDir}/${spriteName}.svg` : undefined
      })
    }

    const runBoth = (force: boolean) =>
      Promise.all([
        fontsGenerator?.run(force) ?? Promise.resolve([] as IconData),
        spriteGenerator?.run(force) ?? Promise.resolve([] as IconData)
      ])

    // 供预览 UI 连接时推送当前状态(非强制,命中缓存)。
    const regenerate = debounce((force: boolean = true) => {
      runBoth(force).then(([fontList, svgList]) => sendUpdate(fontList, svgList))
    }, 500)

    if (watch) {
      const dtsPath = dts === false ? undefined : resolve(root, dts)
      const srcDirs = [fontSourceDir, svgDir].filter(Boolean) as string[]
      for (const d of srcDirs) server.watcher.add(d)

      // 源图标变更:先强制刷新缓存,再(import 模式)用最新缓存重建 .d.ts/barrel、
      // 失效虚拟模块并整页刷新。debounce 合并连续保存,避免每次写盘都全量重生成 + 整页刷新。
      const onSourceChange = debounce(async () => {
        const [fontList, svgList] = await runBoth(true)
        sendUpdate(fontList, svgList)
        if (isImport) {
          try {
            await buildMetasOrThrow()
          } catch (err: any) {
            console.error(c.red(err?.message || err))
          }
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
          if (mod) server.moduleGraph.invalidateModule(mod)
          server.ws.send({ type: 'full-reload' })
        }
      }, 500)

      const onChange = (file: string) => {
        // 忽略插件自己写出的 .d.ts(在项目根、被 Vite 监听),否则写 dts→change→再写 dts 无限刷新。
        if (dtsPath && resolve(file) === dtsPath) return
        const f = resolve(file)
        // 只关心源目录下的 .svg;.vue/.ts 等无关文件保存不再触发重生成与整页刷新。
        if (!f.endsWith('.svg')) return
        if (!srcDirs.some((d) => f === d || f.startsWith(d + sep))) return
        onSourceChange()
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
          if (fontsGenerator) {
            if (isDev) {
              lines.push(fontLinkSnippet(JSON.stringify(`/@fs/${fsDistDir}/${fontName}.css`)))
            } else {
              const cssRef = emitFontAssets(this, distDir, fontName)
              lines.push(fontLinkSnippet(`import.meta.ROLLUP_FILE_URL_${cssRef}`))
            }
          }
          if (spriteGenerator) {
            if (isDev) {
              const spriteUrl = `/@fs/${fsDistDir}/${spriteName}.svg`
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

      // ── class 模式:JS 模块 = 引入 font CSS + 注入 sprite ──
      if (id === RESOLVED_VIRTUAL_REGISTER_ID) {
        const lines: string[] = []
        if (fontsGenerator) {
          await fontsGenerator.run()
          if (isDev) {
            lines.push(fontLinkSnippet(JSON.stringify(`/@fs/${fsDistDir}/${fontName}.css`)))
          } else {
            const cssRef = emitFontAssets(this, distDir, fontName)
            lines.push(fontLinkSnippet(`import.meta.ROLLUP_FILE_URL_${cssRef}`))
          }
        }
        if (spriteGenerator) {
          await spriteGenerator.run()
          if (injectMode === 'inline') {
            lines.push(spriteInlineSnippet(readFileSync(`${distDir}/${spriteName}.svg`, 'utf8')))
          } else if (isDev) {
            lines.push(spriteFetchSnippet(JSON.stringify(`/@fs/${fsDistDir}/${spriteName}.svg`)))
          } else {
            // build:emit 资产 + ROLLUP_FILE_URL,内容在 generateBundle 覆写(与 import 模式一致)。
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
    },
    generateBundle(_outputOptions, bundle) {
      // spriteRef 仅在 build 的 fetch 分支(import 与 class 模式均然)被 emit;
      // inline 模式不 emit、不进此处。按 spriteRef 是否存在判断,不再限定 import 模式。
      if (!spriteGenerator || spriteRef == null) return
      const symbols = spriteGenerator.getSymbols()
      // 抽取每个 chunk 里所有 `#<id>` 引用收进 Set,再与 symbol id 求交集。
      // 带边界(`[\w-]+` 贪婪匹配整段),避免子串误判(`#icon-arrow-left` 不会命中 `icon-arrow`)。
      const referenced = new Set<string>()
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        for (const m of file.code.matchAll(/#([\w-]+)/g)) referenced.add(m[1])
      }
      const body = [...symbols.keys()]
        .filter((useId) => referenced.has(useId))
        .map((useId) => symbols.get(useId) ?? '')
        .join('')
      const asset = bundle[`${spriteName}.svg`]
      if (asset && asset.type === 'asset') asset.source = wrapSprite(body)
    }
  }
}
