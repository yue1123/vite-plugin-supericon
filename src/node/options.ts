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
  /** font 轨 */
  font?: FontTrackOptions
  /** svg / sprite 轨 */
  svg?: SvgTrackOptions
  /** @deprecated 改用 `font.dir` */
  srcDir?: string
  /** @deprecated 改用 `font.name` */
  name?: string
}
