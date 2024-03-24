<template>
  <div class="supericon" :class="iconSize">
    <NavBar />
    <div class="supericon__loading" v-if="isLoading">
      <LoadingSkeleton class="supericon__icon-list-item" v-for="i in 15" :key="i"></LoadingSkeleton>
    </div>
    <div v-else-if="!isLoading && !sortedSearchResults.length" class="empty">No icons...</div>
    <div class="supericon__icon-list" v-else>
      <div
        class="supericon__icon-list-item"
        v-for="item in sortedSearchResults"
        :key="item.id"
        :id="item.useId"
        :title="item.useId"
        @click="() => handleShowDetail(item)"
      >
        <div class="error-info" v-if="item.errTips || item.sameWith">
          <NPopover trigger="hover">
            <template #trigger>
              <Icon icon="gg:info" />
            </template>
            <div v-if="item.sameWith">
              Same as
              <span v-for="icon in item.sameWith">
                <a :href="`#${icon.id}`">{{ icon.id }}</a>
              </span>
            </div>
            <ul style="padding: 0 20px" v-if="item.errTips">
              <li v-for="tips in item.errTips">
                {{ tips }}
              </li>
            </ul>
          </NPopover>
        </div>
        <div class="icon">
          <i :class="item.useId"></i>
        </div>
        <div class="icon-name">
          <div class="icon-name__content">{{ isShowPrefix ? item.useId : item.id }}</div>
          <div class="action-buttons">
            <div class="button-group">
              <ClipboardButton @click.stop title="Copy icon id" :text="item.useId">
                <Icon icon="gg:hashtag" />
              </ClipboardButton>
              <ClipboardButton @click.stop title="Copy html" :text="getHtmlCode(item.useId)">
                <Icon icon="gg:clipboard" />
              </ClipboardButton>
              <ClipboardButton @click.stop title="Copy JSX" :text="getJsxCode(item.useId)">
                <Icon icon="gg:code" />
              </ClipboardButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <DetailsModal
    v-model:show="showDetail"
    :icon-data="currentClickIcon"
    @closed="handleClosed"
  ></DetailsModal>
</template>

<script setup lang="ts">
  import { NPopover } from 'naive-ui'
  import { Icon } from '@iconify/vue'
  import LoadingSkeleton from './LoadingSkeleton.vue'
  import ClipboardButton from '../components/ClipboardButton.vue'
  import {
    isLoading,
    iconSize,
    getHtmlCode,
    getJsxCode,
    sortedSearchResults,
    isShowPrefix,
    _IconDataItem
  } from '../logic'
  import NavBar from './NavBar.vue'
  import DetailsModal from './DetailsModal.vue'
  import { ref } from 'vue'

  const showDetail = ref(false)
  const showTips = ref(false)
  const currentClickIcon = ref<_IconDataItem | null>(null)

  function handleShowDetail(item: _IconDataItem) {
    currentClickIcon.value = item
    showDetail.value = true
  }
  function handleClosed() {
    currentClickIcon.value = null
    showDetail.value = false
  }
</script>

<style lang="scss">
  .supericon {
    margin: 0 auto;
    max-width: 1200px;
    width: 100%;
    min-height: 100%;
    height: auto;
    padding: 15px;

    .empty {
      text-align: center;
      padding: 100px 0;
    }

    &.Small {
      --width: 120px;
      --height: 100px;
      --font-size: 20px;
    }
    &.Medium {
      --width: 140px;
      --height: 120px;
      --font-size: 30px;
    }
    &.Large {
      --width: 160px;
      --height: 140px;
      --font-size: 40px;
    }
    &__icon-list,
    &__loading {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--width), 1fr));
      justify-content: space-around;
      gap: 20px;

      &-item {
        height: var(--height);
        border: 1px solid var(--main-bg);
        display: flex;
        flex-direction: column;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        transition: all 0.3s;
        .error-info {
          position: absolute;
          top: 5px;
          right: 5px;
          line-height: 1;
          color: var(--warn-color);
        }
        .icon {
          overflow: hidden;
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: var(--font-size);
          color: var(--hover-color);
        }

        .icon-name {
          position: relative;
          text-align: center;

          color: var(--main-color);
          &__content {
            width: 100%;
            padding: 5px 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
            transition: {
              property: transform, opacity;
              duration: 0.3s;
            }
          }
        }
        .action-buttons {
          position: absolute;
          width: 100%;
          bottom: 0;
          left: 0;
          opacity: 0;
          transition: {
            property: transform, opacity;
            duration: 0.3s;
          }
          padding: 10px;
          transform: translateY(100%);

          .button-group {
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid var(--main-bg);
          }
          button + button {
            border-left: 1px solid var(--main-bg);
          }
        }

        &:target {
          border: 1px solid var(--hover-color);
        }
        &:hover,
        &:focus-within {
          border: 1px solid var(--hover-color);
          .icon-name__content {
            transform: translateY(-100%);
            opacity: 0;
          }
          .action-buttons {
            transform: translateY(0);
            opacity: 1;
          }
        }
      }
    }
  }
</style>
