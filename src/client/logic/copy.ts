import { copyTagType } from './state'

export function getHtmlCode(id: string) {
  return copyTagType.value === 'single' ? `<i class="${id}" />` : `<i class="${id}"></i>`
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
