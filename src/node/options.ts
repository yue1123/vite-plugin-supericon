import { type RunnerOptions } from 'fantasticon'

export interface GenerateFontOptions
  extends Partial<Pick<RunnerOptions, 'fontHeight' | 'descent' | 'round' | 'selector'>> {}

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
}
