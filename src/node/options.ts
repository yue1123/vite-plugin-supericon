import type { Config as SvgoConfig } from 'svgo'

export interface FontTrackOptions {
  /** font 图标源目录 */
  dir: string
  /** 字体名 @default 'iconfont' */
  name?: string
  descent?: number
  /** @default 300 */
  fontHeight?: number
  round?: number
  selector?: string
  /** @default 'i' */
  tag?: string
  cssTemplate?: string
  /** @default true */
  normalize?: boolean
}

export interface SvgTrackOptions {
  /** svg(sprite)图标源目录 */
  dir: string
  /**
   * sprite 注入方式
   * - 'fetch':运行时 fetch 外联 sprite.svg 后注入
   * - 'inline':sprite 内容内联进虚拟模块,导入时同步注入
   * @default 'fetch'
   */
  inject?: 'fetch' | 'inline'
  /** sprite 文件名(不含扩展名)@default 'sprite' */
  spriteName?: string
  /**
   * svgo 优化配置。
   * - `true`(默认):标准优化(preset-default,保留 viewBox)
   * - `false`:不做优化插件(svgo 仅归一化)
   * - `svgo.Config`:完全自定义优化管线
   *
   * 注:为避免多色图标在 sprite 中串色,插件会自动注入按 symbol 命名空间化内部 id 的
   * `prefixIds`(prefix=symbolId);若你的配置已含 `prefixIds`,以你的为准。
   * 自定义配置请保留 viewBox(`removeViewBox: false`),否则缺尺寸图标会回退默认 viewBox 并告警。
   * @default true
   */
  svgo?: boolean | SvgoConfig
}

export interface Options {
  /** font CSS class 与 sprite symbol id 的共享前缀 @default 'icon' */
  prefix?: string
  /** @default true */
  clearCache?: boolean
  /** @default true */
  watch?: boolean
  /** @default 读取 Vite config */
  base?: string
  /** @default false */
  open?: boolean
  /** @default false */
  silent?: boolean
  /**
   * 消费模式(与交付格式 font/svg 正交,两模式互斥)。
   * - 'class'(默认):`import 'virtual:supericon'` 副作用注入;用 `class="icon-x"` / `<use href="#icon-x">`。
   * - 'import':`import { IconHome } from 'virtual:supericon'` 得组件;`import 'virtual:supericon/register'` 初始化一次。
   * @default 'class'
   */
  mode?: 'class' | 'import'
  /**
   * import 模式生成 `.d.ts` 的路径(相对项目根),用户需在 tsconfig `include` 带上;`false` 关闭。
   * @default 'supericon.d.ts'
   */
  dts?: string | false
  /** font 轨 */
  font?: FontTrackOptions
  /** svg / sprite 轨 */
  svg?: SvgTrackOptions
  /** @deprecated 改用 `font.dir` */
  srcDir?: string
  /** @deprecated 改用 `font.name` */
  name?: string
}
