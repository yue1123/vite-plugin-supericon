<template>
  <header class="flex items-center justify-between gap-4 mt-4 mb-4">
    <!-- Search -->
    <div class="flex-1 max-w-1/3">
      <NInput
        :theme-overrides="{
          heightLarge: '40px',
          paddingLarge: '0 6px',
          fontSizeLarge: '14px',
          borderRadius: 'var(--radius-md)'
        }"
        ref="searchInputRef"
        size="large"
        class="search-input"
        :placeholder="`Search ${totalCount} icons...`"
        clearable
        v-model:value="searchText"
      >
        <template #prefix>
          <Icon icon="bi:search" class="text-base text-fg-subtle ml-2 mr-1" />
        </template>
        <template #suffix>
          <kbd
            class="ml-2 font-mono text-[11px] text-fg-subtle bg-sunken border border-line border-b-2 rounded-sm px-1.5 py-0.5 leading-snug"
          >
            {{ shortcutLabel }}
          </kbd>
        </template>
      </NInput>
    </div>

    <!-- Popover toolbar -->
    <div class="flex items-center gap-2">
      <!-- SORT -->
      <NPopover
        :theme-overrides="{ padding: '0' }"
        trigger="hover"
        placement="bottom-end"
        :show-arrow="false"
      >
        <template #trigger>
          <button class="pop-trigger">
            <Icon :icon="sortLabelIconMap[`${sortMode}:${sortOrderBy}`]" class="text-base" />
            <span>{{ sortModeLabel }}</span>
            <Icon icon="material-symbols:keyboard-arrow-down" class="text-sm text-fg-subtle" />
          </button>
        </template>
        <div class="pop-card">
          <div class="pop-title">排序方式</div>
          <div class="segment-row mb-2">
            <button
              class="flex-1 seg-sm"
              v-for="mode in sortModePresets"
              :key="mode.value"
              :class="[mode.value === sortMode && 'is-active']"
              @click="sortMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
          <button class="sort-dir-row" @click="toggleSortby">
            <Icon
              icon="material-symbols:arrow-upward"
              class="text-base transition-transform duration-150"
              :class="sortDir === 'desc' && 'rotate-180'"
            />
            <span>{{ sortOrderbyLabel }}</span>
          </button>
        </div>
      </NPopover>

      <!-- SIZE -->
      <NPopover
        :theme-overrides="{ padding: '0' }"
        trigger="hover"
        placement="bottom-end"
        :showArrow="false"
      >
        <template #trigger>
          <button class="pop-trigger">
            <Icon icon="material-symbols:format-image-front-outline-rounded" class="text-base" />
            <span>{{ IconSize[iconSize] }}</span>
            <Icon icon="material-symbols:keyboard-arrow-down" class="text-sm text-fg-subtle" />
          </button>
        </template>
        <div class="pop-card">
          <div class="pop-title">图标尺寸</div>
          <div class="segment-row">
            <button
              v-for="size in iconSizePresets"
              :key="size"
              class="seg-sm flex-1"
              :class="[iconSize === size && 'is-active']"
              @click="iconSize = size"
            >
              {{ IconSize[size] }}
            </button>
          </div>
        </div>
      </NPopover>
      <!-- DENSITY -->
      <NPopover
        :theme-overrides="{ padding: '0' }"
        trigger="hover"
        placement="bottom-end"
        :showArrow="false"
        v-if="currentDensity"
      >
        <template #trigger>
          <button class="pop-trigger">
            <Icon :icon="currentDensity.icon" class="text-base" />
            <span>{{ currentDensity.label }}</span>
            <Icon icon="material-symbols:keyboard-arrow-down" class="text-sm text-fg-subtle" />
          </button>
        </template>
        <div class="pop-card">
          <div class="pop-title">网格密度</div>
          <div class="segment-row">
            <button
              v-for="p in densityPresets"
              :key="p.cols"
              class="seg-sm flex gap-1 items-center flex-1"
              :class="[density === p.cols && 'is-active']"
              @click="density = p.cols"
            >
              <Icon
                :icon="p.icon"
                class="text-base transition-transform duration-150"
                :class="sortDir === 'desc' && 'rotate-180'"
              />
              <span>{{ p.label }}</span>
            </button>
          </div>
        </div>
      </NPopover>

      <!-- NAMES TOGGLE -->
      <button
        class="pop-icon-btn"
        :title="showNames ? '隐藏名称' : '显示名称'"
        @click="showNames = !showNames"
      >
        <Icon
          :icon="showNames ? 'material-symbols:visibility' : 'material-symbols:visibility-off'"
          variant="outline"
          class="text-base"
        />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NInput, NPopover, type InputInst } from 'naive-ui'
import { list, searchText, showNames, sortDir } from '../logic'
import { Icon } from '@iconify/vue'
import { useEventListener } from '@vueuse/core'
import {
  iconSizePresets,
  iconSize,
  sortLabelIconMap,
  sortOrderBy,
  sortMode,
  sortModePresets,
  densityPresets,
  density
} from '../logic/state/dispaly'
import { IconSize, OrderBy, SortMode } from '../constants'

const searchInputRef = ref<InputInst | null>(null)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K'
const totalCount = computed(() => list.value.length)

useEventListener('keydown', (event) => {
  const isModifierPressed = event.metaKey || event.ctrlKey
  const isSearchFocusShortcut = isModifierPressed && event.key.toLowerCase() === 'k'

  if (isSearchFocusShortcut) {
    event.preventDefault()
    searchInputRef.value?.focus()
  }
})

const sortModeLabel = computed(() => (sortMode.value === SortMode.DATE ? '时间' : '名称'))
const sortOrderbyLabel = computed(() => {
  if (sortMode.value === SortMode.DATE)
    return sortOrderBy.value === OrderBy.ASC ? '最旧在前' : '最新在前'
  return sortOrderBy.value === OrderBy.ASC ? 'A → Z' : 'Z → A'
})

const currentDensity = computed(() => densityPresets.find((p) => p.cols === density.value))

function toggleSortby() {
  sortOrderBy.value = sortOrderBy.value === OrderBy.ASC ? OrderBy.DESC : OrderBy.ASC
}
</script>

<style lang="scss" scoped>
:global(.n-popover) {
  border: 1px solid var(--border-strong);
}

.pop-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 9px 0 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s var(--ease-out);

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
}

.pop-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-default);
  border-radius: 9px;
  background: var(--bg-sunken);
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.15s var(--ease-out);

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
}

.pop-card {
  min-width: 196px;
  padding: 12px;
}

.pop-title {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  font-weight: 600;
  margin-bottom: 9px;
}

.segment-row {
  display: flex;
  gap: 4px;
  padding: 3px 4px;
  background: var(--bg-sunken);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.seg-sm {
  min-width: 30px;
  height: 28px;
  padding: 0 9px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border: 1px solid transparent;

  &.is-active {
    background: var(--bg-base);
    color: var(--text-primary);
    border-color: var(--border-default);
  }
}

.sort-dir-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  height: 34px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s var(--ease-out);

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
    border-color: var(--border-strong);
  }
}
</style>
