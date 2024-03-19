<template>
  <NModal
    v-model:show="show"
    class="icon-detail__modal"
    size="huge"
    embedded
    :on-after-leave="() => emits('closed')"
    :on-after-enter="getSize"
  >
    <template v-if="props.iconData">
      <div class="icon-detail">
        <div class="icon-detail__canvas" :style="`--size: ${renderSize}`">
          <div class="svg-raw-container">
            <span>
              <img ref="svgRenderRef" :src="`/@fs/${props.iconData.absolutePath}`" alt="" />
            </span>
          </div>
          <div class="iconfont-container">
            <span>
              <i ref="iconFontRenderRef" :class="props.iconData.useId"></i>
            </span>
          </div>
          <div class="size-select">
            <span class="select-icon">
              <Icon icon="bi:rulers"></Icon>
            </span>
            <select name="renderSize" v-model="renderSize">
              <option v-for="item in sizeOptions" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
        </div>
        <div class="icon-detail__canvas-caption">
          <div>SVG rendering ({{ svgRenderSize && svgRenderSize.join(' x ') }})</div>
          <div>Iconfont rendering ({{ iconFontRenderSize && iconFontRenderSize.join(' x ') }})</div>
        </div>
        <div class="icon-detail__info">
          <div class="description-cell">
            <div class="title">Id</div>
            <div class="content">{{ props.iconData.useId }}</div>
          </div>
          <div class="description-cell">
            <div class="title">Absolute Path</div>
            <div class="content">{{ props.iconData.absolutePath }}</div>
            <ClipboardButton ghost :text="props.iconData.absolutePath">
              <Icon icon="gg:copy" />
              <template #copied>
                <Icon icon="gg:check" />
              </template>
            </ClipboardButton>
          </div>
          <div class="description-cell">
            <div class="title">Relative Path</div>
            <div class="content">{{ props.iconData.relativePath }}</div>
            <ClipboardButton ghost :text="props.iconData.relativePath">
              <Icon icon="gg:copy" />
              <template #copied>
                <Icon icon="gg:check" />
              </template>
            </ClipboardButton>
          </div>
          <div class="description-cell">
            <div class="title">Last Modified</div>
            <div class="content">{{ formatDate }} {{ relativeDate }}</div>
          </div>
        </div>
      </div>
    </template>
    <span v-else></span>
  </NModal>
</template>

<script setup lang="ts">
  import { NModal } from 'naive-ui'
  import { computed, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'
  import ClipboardButton from '../components/ClipboardButton.vue'
  import {
    _IconDataItem,
    formatRelativeDate,
    tryFixDecimal,
    renderSize,
    sizeOptions
  } from '../logic'

  export interface Props {
    iconData: _IconDataItem | null
    show: boolean
  }
  const props = defineProps<Props>()
  const emits = defineEmits(['closed', 'update:show'])

  const show = computed({
    get() {
      return props.show
    },
    set(value) {
      emits('update:show', value)
    }
  })
  const svgRenderRef = ref<HTMLSpanElement>()
  const iconFontRenderRef = ref<HTMLSpanElement>()

  const svgRenderSize = ref<[number, number] | void>()
  const iconFontRenderSize = ref<[number, number] | void>()

  const lastModified = computed(() =>
    props.iconData ? new Date(props.iconData.lastModified) : new Date()
  )

  const formatDate = computed(() => lastModified.value.toLocaleString())
  const relativeDate = computed(() => {
    const res = formatRelativeDate(lastModified.value)
    return res ? `（${res}）` : ''
  })
  watch(
    () => renderSize.value,
    () => {
      show.value && requestAnimationFrame(getSize)
    }
  )
  function getSize() {
    if (svgRenderRef.value) {
      const { width, height } = svgRenderRef.value.getBoundingClientRect()
      svgRenderSize.value = [tryFixDecimal(width), tryFixDecimal(height)]
    }
    if (iconFontRenderRef.value) {
      const { width, height } = iconFontRenderRef.value.getBoundingClientRect()
      iconFontRenderSize.value = [tryFixDecimal(width), tryFixDecimal(height)]
    }
  }
</script>

<style lang="scss">
  $polyline: 1px dashed #444444;
  .icon-detail {
    &__modal {
      --n-padding-left: 0;
      --n-padding-bottom: 0;
      --n-padding-top: 0;
      --n-bezier-ease-out: cubic-bezier(0.76, 0, 0.24, 1);
      width: 500px;
      background: var(--modal-bg);
      border-radius: 8px;
      overflow: hidden;
    }
    &__canvas {
      display: flex;
      height: 200px;
      position: relative;
      .svg-raw-container,
      .iconfont-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        background-color: #2a2a2a;
        background-image: radial-gradient(circle, #454649 1px, transparent 1px);
        background-size: 1rem 1rem;
        color: #fff;
        overflow: hidden;
        img,
        i,
        span {
          user-select: none;
          -webkit-user-drag: none;
          line-height: 0;
        }
        span {
          position: relative;
          display: inline-block;
        }
        span::before,
        span::after {
          content: '';
          transform: translateX(-50%) translateY(-50%);
          position: absolute;
          top: 50%;
          left: 50%;
          transition: border 0.3s;
          user-select: none;
          pointer-events: none;
        }
        span::before {
          width: 2000%;
          height: 100%;
          border-top: $polyline;
          border-bottom: $polyline;
        }
        span::after {
          height: 2000%;
          width: 100%;
          border-left: $polyline;
          border-right: $polyline;
        }
      }

      .svg-raw-container {
        img {
          width: var(--size);
        }
      }

      .iconfont-container i {
        display: block;
        font-size: 0;
        float: left;
        &::before {
          font-size: var(--size);
        }
      }

      &:hover {
        .svg-raw-container,
        .iconfont-container {
          span::before,
          span::after {
            border-color: #666;
          }
        }
      }
      &-caption {
        display: flex;
        justify-content: space-around;
        padding: 8px 0;
        margin-bottom: 12px;
        font-size: 12px;
        color: var(--main-color);
      }

      .size-select {
        position: absolute;
        bottom: 10px;
        right: 10px;
        color: #fff;
        width: 25px;
        height: 25px;
        line-height: 0;
        border-radius: 4px;

        &:hover {
          background: #444;
        }
        span,
        select {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(180deg);
        }
        select {
          opacity: 0;
        }
      }
    }
    &__info {
      padding: 15px 15px 30px;
    }
    .description-cell {
      display: flex;
      justify-content: flex-start;
      align-items: flex-start;
      &:not(:first-child) {
        margin-top: 10px;
      }
      .title {
        color: var(--main-color);
        width: 110px;
        text-align: right;
        margin-right: 15px;
        flex-shrink: 0;
      }
      .content {
        color: var(--hover-color);
        word-break: break-all;
      }
    }
  }
</style>
