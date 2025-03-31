import { copyTagType } from './state'

export function getHtmlCode(id: string) {
  return copyTagType.value === 'single' ? `<i class="${id}" />` : `<i class="${id}"></i>`
}

export function getJsxCode(id: string) {
  return copyTagType.value === 'single' ? `<i className="${id}" />` : `<i className="${id}"></i>`
}
