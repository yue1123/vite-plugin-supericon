export interface GenerateFontOptions {
  /**
   * Svg icons source folder.
   */
  srcDir: string
  /**
   * Name of icons font
   * @default 'iconfont
   */
  name?: string
  /**
   * Icon css class prefix
   * @default icon
   */
  prefix?: string
  /**
   * The font descent
   */
  descent?: number
  /**
   * The output font height (icons will be scaled so the highest has this height)
   * @default 300
   */
  fontHeight?: number
  /**
   * Setup the SVG path rounding [10e12]
   */
  round?: number
  /**
   * Use a CSS selector instead of 'tag + prefix'
   */
  selector?: string
  /**
   * CSS base tag for icons
   * @default i
   */
  tag?: string
  /**
   * Use a custom Handlebars template file to generate css file
   *
   * The value is file path
   */
  cssTemplate?: string
  /**
   * normalize icons by scaling them to the height of the highest icon
   * @default true
   */
  normalize?: boolean
}

export interface Options extends GenerateFontOptions {
  /**
   * clear cache pre server start
   *
   * @default true
   */
  clearCache?: boolean
  /**
   * Watch srcDir files change
   *
   * @default true
   */
  watch?: boolean
  /**
   * Base URL for superIcon UI
   *
   * @default read from Vite's config
   */
  base?: string
  /**
   * Automatically open super icon page in browser
   * @default false
   */
  open?: boolean
  /**
   * Print URL output silently in the terminal
   * @default false
   */
  silent?: boolean
}
