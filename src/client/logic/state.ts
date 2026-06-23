import { IconDataItem, UpdatePayload } from '../../types'
import { computed, ref, watch } from 'vue'
import { baseUrl, getHot } from './getHot'
import { searchResults } from './search'
import { useStorage } from '@vueuse/core'
import { createDiscreteApi } from 'naive-ui'
import { findDuplicates } from '../utils/svg/dedup'
import { analyzeIcon } from '../utils/svg/repair'

export interface _IconDataItem extends IconDataItem {
  /** svg body same with other icon */
  sameWith?: _IconDataItem[]
  /** error message array, like fill color not incorrect */
  errTips?: string[]
  /** font-render problem: 'winding' = fixable (evenodd/holes), 'stroke' = needs outline */
  renderIssue?: 'winding' | 'stroke'
}
export type IconData = _IconDataItem[]

export const sortModes = ['default', 'date'] as const
export const iconSizes = ['S', 'M', 'L', 'XL'] as const
export type IconSizeKey = (typeof iconSizes)[number]
export const copyTagTypes = ['Single', 'Paired'] as const
export const list = ref<IconData>([])
export const isLoading = ref(true)

export const sortMode = useStorage<'date' | 'default'>('vite-supericon:sort-mode', 'default')
export const isShowPrefix = useStorage('vite-supericon:show-prefix', true)
export const copyTagType = useStorage('vite-supericon:copy-tag-type', copyTagTypes[1])
export const renderSize = useStorage('vite-supericon:render-size', '64px')

export const sortDirections = ['asc', 'desc'] as const
export const densityPresets = [
  { label: '紧凑', cols: 9 },
  { label: '适中', cols: 8 },
  { label: '舒适', cols: 7 }
] as const

export const sortDir = useStorage<'asc' | 'desc'>('vite-supericon:sort-dir', 'asc')
export const density = useStorage<number>('vite-supericon:density', 8)
export const showNames = useStorage<boolean>('vite-supericon:show-names', true)
export const issuesOnly = useStorage<boolean>('vite-supericon:issues-only', false)

// 当前选中的类别标签；null 表示「全部」。单选、持久化。
export const selectedTag = useStorage<string | null>('vite-supericon:selected-tag', null)

// 基于全量 list 统计的标签 → 出现次数，按名排序，供「分类」下拉展示。
export const availableTags = computed<{ name: string; count: number }[]>(() => {
  const counts = new Map<string, number>()
  for (const item of list.value) {
    for (const tag of item.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

export type Page = 'library' | 'help'
export const page = ref<Page>('library')

// const fillColorWhiteList = ['#fff', '#ffffff', '#000', '#000000', 'white', 'black']

export const sortedSearchResults = computed(() => {
  let results = [...searchResults.value]

  if (issuesOnly.value) {
    results = results.filter((i) => i.sameWith || i.errTips || i.renderIssue)
  }

  if (selectedTag.value) {
    results = results.filter((i) => i.tags?.includes(selectedTag.value!))
  }

  if (sortMode.value === 'date') {
    results.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  } else {
    results.sort((a, b) => a.id.localeCompare(b.id))
  }

  if (sortDir.value === 'desc') results.reverse()
  return results
})

export const issueCounts = computed(() => {
  let dup = 0
  let conflict = 0
  let render = 0
  let total = 0
  for (const i of list.value) {
    if (i.sameWith) dup++
    if (i.errTips) conflict++
    if (i.renderIssue) render++
    if (i.sameWith || i.errTips || i.renderIssue) total++ // distinct problem icons
  }
  return { dup, conflict, render, total }
})

getHot().then((hot) => {
  if (hot) hot.on('vite-plugin-supericon:update', update)
})

// 当选中的标签因目录被删/改名而从 availableTags 中消失时，重置为「全部」，
// 避免出现无法解释的空网格。
watch(availableTags, (tags) => {
  if (selectedTag.value && !tags.some((t) => t.name === selectedTag.value)) {
    selectedTag.value = null
  }
})

export function toggleSort() {
  sortMode.value = sortModes[(sortModes.indexOf(sortMode.value) + 1) % sortModes.length]
}

function update(data: UpdatePayload) {
  list.value = data.iconList

  if (data.spritePath) injectPreviewSprite(data.spritePath)

  const styleLink = document.getElementById('supericon') as HTMLLinkElement
  const href = `${baseUrl || ''}@fs/${data.cssPath}?v=${Date.now()}`

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
  detectRenderIssues(list.value)
}

// 取插件产出的 sprite.svg(经 Vite @fs 服务),内联注入预览 DOM,
// 使 svg 图标的 <use href="#useId"> 在预览中可解析;每次 update 替换式重注。
let spriteToken = 0
async function injectPreviewSprite(spritePath: string) {
  const token = ++spriteToken
  try {
    const url = `${baseUrl || ''}@fs/${spritePath}?v=${Date.now()}`
    const res = await fetch(url)
    if (!res.ok) return
    const txt = (await res.text()).trim()
    if (token !== spriteToken) return
    const tpl = document.createElement('template')
    tpl.innerHTML = txt
    const svg = tpl.content.firstElementChild as SVGElement | null
    if (!svg) return
    svg.id = '__supericon_preview_sprite'
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.style.width = '0'
    svg.style.height = '0'
    svg.style.overflow = 'hidden'
    const old = document.getElementById('__supericon_preview_sprite')
    if (old) old.replaceWith(svg)
    else document.body.prepend(svg)
  } catch {
    // sprite 不可用时静默,svg 图标显示空白,不阻断 font
  }
}

// Flag icons that render wrong as a glyph (font winding / stroke). Uses paper,
// so it runs async after the list is shown; chunked to keep the UI responsive.
let scanToken = 0
async function detectRenderIssues(items: IconData) {
  const token = ++scanToken
  for (let i = 0; i < items.length; i++) {
    if (token !== scanToken) return // a newer update superseded this scan
    const item = items[i]
    if (item.format === 'svg') {
      // svg 图标不入字体,无 winding/stroke 渲染问题
      item.renderIssue = undefined
      continue
    }
    try {
      const info = await analyzeIcon(item.svg || item.svgBody)
      item.renderIssue = info.needsRepair
        ? info.reason === 'stroke'
          ? 'stroke'
          : 'winding'
        : undefined
    } catch {
      item.renderIssue = undefined
    }
    if ((i & 15) === 15) await new Promise((r) => setTimeout(r)) // yield every 16
  }
}

// Flag duplicate icons (same NORMALIZED geometry, different id) by linking each
// to its peers via `sameWith`. Reuses findDuplicates so the hashing lives in one
// place; catches recolor / reformat / precision dups, not just byte-identical.
function check(iconList: _IconDataItem[]) {
  for (const item of iconList) item.sameWith = undefined
  // NOTE(P3): dedup is name-based (keyed by `id`); when the same icon name exists
  // in BOTH the font and svg tracks, byId collapses them and `sameWith` peer
  // resolution may pick the wrong-format item. Cross-dir identifier uniqueness is
  // deferred to P3 (see design spec §1); disjoint dirs / distinct names are unaffected.
  const byId = new Map(iconList.map((item) => [item.id, item]))
  for (const { ids } of findDuplicates(iconList)) {
    const peers = ids.map((id) => byId.get(id)).filter(Boolean) as _IconDataItem[]
    for (const item of peers) item.sameWith = peers.filter((other) => other !== item)
  }
}
