import { useStorage } from '@vueuse/core'
import { list } from './state'
import { computed } from 'vue'

export const searchText = useStorage('vite-supericon-search-text', '')

export const searchResults = computed(() => {
  return list.value.filter((item) => item.id.includes(searchText.value))
})
export const iconCount = computed(() => searchResults.value.length)
