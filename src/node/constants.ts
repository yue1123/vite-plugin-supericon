export const NAME = 'vite-plugin-supericon'
export const isCI = !!process.env.CI
export const CLIENT_URL = '__supericon'
export const VIRTUAL_MODULE_ID = 'virtual:supericon'
export const RESOLVED_VIRTUAL_MODULE_ID = '\0' + 'virtual-supericon.css'
export const DEFAULT_FONT_NAME = 'iconfont'
export const SVG_FILL_COLOR_REG = /(?:fill|stroke)="(.+?)"/
export const SVG_TAG_REG = /<\/*svg[\w\W]*?>/gm
export const XML_TAG_REG = /<\?xml.*>/gm