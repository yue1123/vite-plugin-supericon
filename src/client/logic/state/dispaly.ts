// display state here

import { useStorage } from '@vueuse/core'
import { STORAGE_KEY_PREFIX, IconSize, SortMode, OrderBy } from '../../constants'

export const isShowPrefix = useStorage(`${STORAGE_KEY_PREFIX}:show-prefix`, true)
export const iconSize = useStorage<IconSize>(`${STORAGE_KEY_PREFIX}:icon-size`, IconSize.M)
export const density = useStorage<number>('vite-supericon:density', 8)
export const sortMode = useStorage<SortMode>(`${STORAGE_KEY_PREFIX}:sort-mode`, SortMode.DATE)
export const sortOrderBy = useStorage<OrderBy>(`${STORAGE_KEY_PREFIX}:sort-orderby`, OrderBy.DESC)

export const densityPresets = [
  { label: '舒适', icon: 'material-symbols:grid-view-rounded', cols: 7 },
  { label: '适中', icon: 'material-symbols:grid-on', cols: 8 },
  { label: '紧凑', icon: 'material-symbols:background-grid-small', cols: 9 }
] as const

export const iconSizePresets = [IconSize.S, IconSize.M, IconSize.L, IconSize.XL]

export const sortModePresets: { value: SortMode; label: string }[] = [
  { value: SortMode.NAME, label: '名称' },
  { value: SortMode.DATE, label: '时间' }
]
export const sortLabelIconMap: Record<`${SortMode}:${OrderBy}`, string> = {
  [`${SortMode.DATE}:${OrderBy.ASC}`]: 'material-symbols:clock-arrow-up-outline-rounded',
  [`${SortMode.DATE}:${OrderBy.DESC}`]: 'material-symbols:clock-arrow-down-outline-rounded',
  [`${SortMode.NAME}:${OrderBy.ASC}`]: 'tabler:sort-ascending-letters',
  [`${SortMode.NAME}:${OrderBy.DESC}`]: 'tabler:sort-descending-letters'
}
