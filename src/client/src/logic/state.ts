import { IconDataItem, UpdatePayload } from '../../types'
import { computed, ref } from 'vue'
import { getHot } from './getHot'
import { searchResults, searchText } from './search'
import { useStorage } from '@vueuse/core'
import { createDiscreteApi } from 'naive-ui'

export interface _IconDataItem extends IconDataItem {
  /** svg body same with other icon */
  sameWith?: _IconDataItem[]
  /** error message array, like fill color not incorrect */
  errTips?: string[]
}
export type IconData = _IconDataItem[]

export const sortModes = ['default', 'date'] as const
export const iconSizes = ['Small', 'Medium', 'Large'] as const
export const copyTagTypes = ['Single', 'Paired'] as const
export const list = ref<IconData>([])
export const isLoading = ref(!import.meta.env.DEV)

export const sortMode = useStorage<'date' | 'default'>('vite-supericon:sort-mode', 'default')
export const isShowPrefix = useStorage('vite-supericon:show-prefix', true)
export const iconSize = useStorage('vite-supericon:size', iconSizes[1])
export const copyTagType = useStorage('vite-supericon:copy-tag-type', copyTagTypes[1])
export const renderSize = useStorage('vite-supericon:render-size', '64px')

// const fillColorWhiteList = ['#fff', '#ffffff', '#000', '#000000', 'white', 'black']

export const sortedSearchResults = computed(() => {
  if (searchText.value) return searchResults.value
  const clonedSearchResults = [...searchResults.value]
  if (sortMode.value === 'date')
    clonedSearchResults.sort((a, b) => {
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })
  return clonedSearchResults
})

getHot().then((hot) => {
  if (hot) hot.on('vite-plugin-supericon:update', update)
})

export function toggleSort() {
  sortMode.value = sortModes[(sortModes.indexOf(sortMode.value) + 1) % sortModes.length]
}

function update(data: UpdatePayload) {
  list.value = data.iconList

  const styleLink = document.getElementById('supericon') as HTMLLinkElement
  const href = `/@fs/${data.cssPath}?v=${Date.now()}`

  if (styleLink) {
    styleLink.href = href
  } else {
    const link = document.createElement('link')
    link.id = 'supericon'
    link.rel = 'stylesheet'
    link.href = href
    isLoading.value = true
    link.onload = function () {
      isLoading.value = false
    }
    link.onerror = function () {
      const { message } = createDiscreteApi(['message'])
      console.error(
        '[vite-plugin-supericon] Link file can not be find, please restart vite server and try again'
      )
      message.error('Link file can not be find, please restart vite server and try again')
    }
    document.head.append(link)
  }

  check(list.value)
}

function check(iconList: IconData) {
  const map = new Map<string, _IconDataItem>()

  // check same icon
  iconList.forEach((item: _IconDataItem) => {
    let existIcon: _IconDataItem | void
    if ((existIcon = map.get(item.svgBody))) {
      if (!item.sameWith) {
        item.sameWith = [existIcon]
      } else {
        item.sameWith.push(existIcon)
      }
    }
    map.set(item.svgBody, item)

    // check svg fill color
    // let color = svgBody.match(SVG_FILL_COLOR_REG)
    // if (color && color[1] === 'none') {
    //   console.log(item, svgBody)
    //   item.errTips = [`Original svg fill color cannot be none`]
    // }
  })
}
