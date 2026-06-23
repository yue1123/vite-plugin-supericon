export const NAME = 'vite-plugin-supericon'
export const isCI = !!process.env.CI
export const CLIENT_URL = '__supericon'
export const VIRTUAL_MODULE_ID = 'virtual:supericon'
// 公共入口改为 JS 模块(去掉 .css 后缀,Vite 即按 JS 处理)
export const RESOLVED_VIRTUAL_MODULE_ID = '\0virtual-supericon'
// 内部嵌套 font CSS 虚拟模块(承接原 CSS 逻辑,保留 Vite CSS 管线)
export const VIRTUAL_FONT_CSS_ID = 'virtual:supericon/font.css'
export const RESOLVED_VIRTUAL_FONT_CSS_ID = '\0virtual-supericon-font.css'
export const DEFAULT_FONT_NAME = 'iconfont'
export const DEFAULT_SPRITE_NAME = 'sprite'
export const SVG_FILL_COLOR_REG = /(?:fill|stroke)="(.+?)"/
export const SVG_TAG_REG = /<\/*svg[\w\W]*?>/gm
export const XML_TAG_REG = /<\?xml.*>/gm
export const SVG_VIEWBOX_REG = /viewBox\s*=\s*"([^"]*)"/