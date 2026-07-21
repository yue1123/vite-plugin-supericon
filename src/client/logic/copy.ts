import { copyTagType, mode, type _IconDataItem } from './state'

export function getHtmlCode(id: string) {
  return copyTagType.value === 'single' ? `<i class="${id}" />` : `<i class="${id}"></i>`
}

/** import 模式:导入语句 + 组件用法的自包含片段。 */
export function getImportSnippet(exportName: string) {
  const usage =
    copyTagType.value === 'single' ? `<${exportName} />` : `<${exportName}></${exportName}>`
  return `import { ${exportName} } from 'virtual:supericon'\n\n${usage}`
}

/**
 * 主「复制代码」:按当前 mode 与图标 track 产出最合适的片段。
 * - import 模式 → 导入语句 + 用法(自包含)
 * - class 模式 → svg 走 `<use href="#id">`,font 走 `<i class="icon-xxx">`
 */
export function getIconCode(item: _IconDataItem) {
  if (mode.value === 'import' && item.exportName) {
    return getImportSnippet(item.exportName)
  }
  return item.format === 'svg' ? getSvgUseCode(item.useId) : getHtmlCode(item.useId)
}

export function getJsxCode(id: string) {
  return copyTagType.value === 'single' ? `<i className="${id}" />` : `<i className="${id}"></i>`
}

export function getVueCode(id: string) {
  return `<i class="${id}"></i>`
}

export function getCssCode(id: string, unicode?: string) {
  const escaped = unicode ? `'\\${unicode.replace(/^\\?/, '')}'` : `''`
  return `.${id}::before {\n  font-family: 'supericon';\n  content: ${escaped};\n}`
}

export function getSvgUseCode(useId: string) {
  return `<svg aria-hidden="true"><use href="#${useId}" /></svg>`
}
