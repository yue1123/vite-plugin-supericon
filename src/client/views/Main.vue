<template>
  <div class="gradient-bg"></div>
  <div class="mx-auto max-w-360 min-w-300 w-full min-h-full h-auto px-4 pb-10">
    <NavBar />

    <HelpPage v-if="page === 'help'" />

    <template v-else>
      <Header />

      <!-- Loading -->
      <LoadingSkeleton v-if="isLoading" />

      <template v-else>
        <div class="flex items-center gap-2 mb-5">
          <NPopover
            v-if="availableTags.length"
            :theme-overrides="{ padding: '0' }"
            trigger="hover"
            placement="bottom-start"
            :show-arrow="false"
          >
            <template #trigger>
              <button
                class="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 border"
                style="
                  background: var(--accent);
                  color: var(--text-on-accent);
                  border-color: var(--accent);
                  box-shadow: 0 5px 14px -4px color-mix(in srgb, var(--accent) 55%, transparent);
                "
              >
                <Icon icon="material-symbols:category-outline-rounded" class="text-sm" />
                {{ selectedTag ?? '全部' }}
                <span
                  class="text-[10.5px] font-bold rounded-sm px-1 py-px"
                  style="
                    background: color-mix(in srgb, #000 16%, transparent);
                    color: var(--text-on-accent);
                  "
                >
                  {{ selectedTagCount }}
                </span>
                <Icon icon="material-symbols:keyboard-arrow-down" class="text-sm opacity-70" />
              </button>
            </template>
            <div class="pop-card">
              <div class="pop-title">分类</div>
              <div class="tag-list">
                <button
                  class="tag-row"
                  :class="[selectedTag === null && 'is-active']"
                  @click="selectedTag = null"
                >
                  <span>全部</span>
                  <span class="tag-count">{{ totalCount }}</span>
                </button>
                <button
                  v-for="tag in availableTags"
                  :key="tag.name"
                  class="tag-row"
                  :class="[selectedTag === tag.name && 'is-active']"
                  @click="selectedTag = tag.name"
                >
                  <span>{{ tag.name }}</span>
                  <span class="tag-count">{{ tag.count }}</span>
                </button>
              </div>
            </div>
          </NPopover>

          <div class="flex-1" />

          <button
            v-if="issueCounts.total > 0"
            class="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors duration-150 border"
            :style="
              issuesOnly
                ? 'background:var(--warn-soft);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 32%,transparent);'
                : 'background:var(--bg-surface);color:var(--text-secondary);border-color:var(--border-default);'
            "
            @click="issuesOnly = !issuesOnly"
          >
            <span class="inline-flex w-1.5 h-1.5 rounded-full bg-warn" />
            {{ issueCounts.total }} 个问题
            <span class="text-fg-subtle">·</span>
            <span>{{ issueCounts.dup }} 重复</span>
            <span class="text-fg-subtle">·</span>
            <span>{{ issueCounts.conflict }} 冲突</span>
            <span class="text-fg-subtle">·</span>
            <span>{{ issueCounts.render }} 渲染</span>
          </button>
        </div>
        <!-- Empty -->
        <NResult
          v-if="!sortedSearchResults.length"
          status="warning"
          description="0 icons"
          class="mt-40"
        >
          <template #icon>
            <Icon
              icon="material-symbols:search-off"
              variant="outline"
              class="text-8xl opacity-45"
            />
          </template>
          <template #footer>
            <button
              class="h-9 px-4 rounded-md text-sm cursor-pointer transition-colors duration-150 border border-line bg-surface text-fg-muted hover:text-fg hover:border-line-strong"
              @click="clearSearch"
              v-if="searchText"
            >
              清除筛选
            </button>
          </template>
        </NResult>

        <!-- Grid -->
        <div v-else class="icon-grid" :style="gridStyle">
          <div
            v-for="item in sortedSearchResults"
            :key="item.format + '/' + item.id"
            :id="item.format + '-' + item.useId"
            :title="`点击查看 ${item.useId} 详情`"
            class="icon-card"
            :class="{
              'icon-card--flagged': item.errTips || item.sameWith || item.renderIssue
            }"
            @click="() => handleShowDetail(item)"
          >
            <!-- Format badge (svg only) -->
            <span v-if="item.format === 'svg'" class="badge-format">SVG</span>

            <!-- Flag badge -->
            <span v-if="item.errTips || item.renderIssue" class="badge-flag">
              {{ item.errTips ? '冲突' : item.renderIssue === 'stroke' ? '描边' : '渲染' }}
            </span>
            <NPopover
              v-else-if="item.sameWith"
              trigger="hover"
              placement="top"
              :keep-alive-on-hover="true"
              :style="{ padding: '8px' }"
            >
              <template #trigger>
                <span class="badge-flag" @click.stop>重复</span>
              </template>
              <div class="dup-pop" @click.stop>
                <div class="dup-pop__title">与以下图标重复:</div>
                <ul class="list-disc list-inside">
                  <li
                    v-for="peer in item.sameWith"
                    :key="peer.id"
                    class="dup-pop__item"
                    @click="jumpTo(peer)"
                  >
                    {{ peer.id }}
                  </li>
                </ul>
              </div>
            </NPopover>

            <!-- Id -->
            <div class="icon-card__glyph" :style="{ fontSize: iconSize + 'px' }">
              <i v-if="item.format !== 'svg'" :class="item.useId"></i>
              <svg v-else :width="iconSize" :height="iconSize" aria-hidden="true">
                <use :href="`#${item.useId}`" />
              </svg>
            </div>

            <!-- Name -->
            <div
              v-if="showNames"
              class="icon-card__name text-[12px] text-fg-muted text-center w-full overflow-hidden text-ellipsis whitespace-nowrap absolute left-1/2 -translate-x-1/2 bottom-5 px-1"
            >
              {{ item.id }}
            </div>

            <!-- Hover actions -->
            <div class="icon-card__actions">
              <ClipboardButton
                class="icon-card__action-btn"
                title="复制图标代码"
                @click.stop
                @success="() => handleCopyHtmlSuccess(item)"
                :text="getHtmlCode(item.useId)"
              >
                <Icon icon="gg:code" class="text-base" />
              </ClipboardButton>
              <ClipboardButton
                class="icon-card__action-btn"
                title="复制 id"
                @click.stop
                @success="() => handleCopyIdSuccess(item)"
                :text="item.useId"
              >
                <Icon icon="gg:hashtag" class="text-base" />
              </ClipboardButton>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>

  <DetailsModal v-model:show="showDetail" :icon-data="currentClickIcon" @closed="handleClosed" />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useMessage, NResult, NPopover } from 'naive-ui'
import LoadingSkeleton from './LoadingSkeleton.vue'
import { Icon } from '@iconify/vue'
import ClipboardButton from '../components/ClipboardButton.vue'
import {
  isLoading,
  getHtmlCode,
  sortedSearchResults,
  searchText,
  list,
  density,
  showNames,
  issuesOnly,
  issueCounts,
  sortMode,
  sortDir,
  selectedTag,
  availableTags,
  page,
  _IconDataItem
} from '../logic'
import Header from './Header.vue'
import NavBar from './NavBar.vue'
import DetailsModal from './DetailsModal.vue'
import HelpPage from './HelpPage.vue'
import { iconSize } from '../logic/state/dispaly.js'

const message = useMessage()
const showDetail = ref(false)
const currentClickIcon = ref<_IconDataItem | null>(null)

const totalCount = computed(() => list.value.length)
const selectedTagCount = computed(() => {
  if (!selectedTag.value) return totalCount.value
  return availableTags.value.find((t) => t.name === selectedTag.value)?.count ?? 0
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${density.value}, minmax(0, 1fr))`
}))

function handleShowDetail(item: _IconDataItem) {
  currentClickIcon.value = item
  showDetail.value = true
}
function handleClosed() {
  // currentClickIcon.value = null
  showDetail.value = false
}
function handleCopyHtmlSuccess(item: _IconDataItem) {
  message.success(`已复制 ${item.id} 代码`)
}
function handleCopyIdSuccess(item: _IconDataItem) {
  navigator.clipboard?.writeText(item.useId)
  message.success(`已复制 id：${item.useId}`)
}
function clearSearch() {
  searchText.value = ''
  issuesOnly.value = false
  selectedTag.value = null
  sortMode.value = 'default'
  sortDir.value = 'asc'
}

// Jump to a duplicate peer's card (scroll + flash). Clears filters if the
// target is currently filtered out of the list.
async function jumpTo(peer: _IconDataItem) {
  let el = document.getElementById(peer.format + '-' + peer.useId)
  if (!el) {
    searchText.value = ''
    issuesOnly.value = false
    selectedTag.value = null
    await nextTick()
    el = document.getElementById(peer.format + '-' + peer.useId)
  }
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('icon-card--flash')
  const target = el
  setTimeout(() => target.classList.remove('icon-card--flash'), 1200)
}
</script>

<style lang="scss" scoped>
.badge-flag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  color: var(--warn);
  border: 1px solid color-mix(in srgb, var(--warn) 32%, transparent);
  cursor: default;
}

.badge-format {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  font-size: 9.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
  color: var(--accent-active);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  cursor: default;
}

/* Duplicate peers popover */
.dup-pop {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
  max-width: 240px;
}
.dup-pop__title {
  font-size: 11px;
  color: var(--text-muted);
}
.dup-pop__item {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent-active);
  opacity: 0.7;
  cursor: pointer;
}

.dup-pop__item:hover {
  opacity: 1;
}

/* Flash a card when jumped to */
.icon-card--flash {
  animation: icon-card-flash 1.2s var(--ease-out);
}
@keyframes icon-card-flash {
  0%,
  100% {
    box-shadow: var(--shadow-sm);
  }
  25% {
    box-shadow:
      0 0 0 2px var(--accent),
      var(--shadow-md);
    border-color: var(--accent);
  }
}

.icon-card {
  position: relative;
  aspect-ratio: 1;
  min-height: 92px;
  display: flex;
  overflow: hidden;
  padding: 0 12px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.3s var(--ease-out),
    box-shadow 0.3s var(--ease-out);

  &--flagged {
    border: 1px solid color-mix(in srgb, var(--color-warn) 20%, transparent);
  }

  &:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border-strong));
    box-shadow:
      var(--shadow-md),
      0 0 0 1px var(--accent-soft);
  }

  &__glyph {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 48%;
    left: 50%;
    color: var(--text-secondary);
    min-height: 0;
    transform: translate(-50%, -50%);
    & > * {
      line-height: 0;
    }
  }

  &__name {
    opacity: 1;
    transform: translateY(0);
  }

  &:hover &__glyph {
    transform: translate(-50%, -75%);
  }

  &:hover &__name {
    opacity: 0;
    transform: translateY(-100%);
  }

  &__glyph,
  &__name,
  &__actions {
    transition-property: opacity, transform;
    transition: 0.2s var(--ease-out);
  }

  &__actions {
    position: absolute;
    left: 50%;
    width: 100%;
    bottom: 0.75rem;
    display: flex;
    gap: 4px;
    max-width: 120px;
    opacity: 0;
    pointer-events: none;
    pointer-events: auto;
    padding: 0.25rem;
    border-radius: calc(infinity * 1px);
    transform: translateY(100%) translateX(-50%);
    background: var(--bg-sunken);
    border: 1px solid var(--border-strong);
  }

  &:hover &__actions {
    opacity: 1;
    transform: translateY(0px) translateX(-50%);
  }

  &__action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 26px;
    border-radius: calc(infinity * 1px);
    border: 1px solid transparent;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    flex: 1;
    transition: 0.2s var(--ease-out);

    &:hover {
      background: var(--bg-base);
      border-color: var(--border-strong);
      border-color: var(--border-default);
    }
  }
}

/* Category dropdown (popover content) */
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
.tag-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 280px;
  overflow-y: auto;
}
.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.15s var(--ease-out);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-sunken);
  }

  &.is-active {
    background: var(--bg-base);
    color: var(--text-primary);
    border-color: var(--border-default);
  }
}
.tag-count {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
