<template>
  <NModal class="draw-tips__modal" preset="card" title="Icon Drawing Guide" v-model:show="show">
    <NP>
      If you find that some of the icons do not render properly when converted to font icons, it is
      recommended that you make a change.
    </NP>
    <NOl>
      <NLi>
        Remove all fills and colors. You can probably leave black fills. In fonts, fill is defined
        by contour direction. Make sure that you don't have any complex rules like evenodd fills.
      </NLi>
      <NLi>
        Remove all FAT line (line with stroke-width) attributes. This is not supported . In fonts,
        fat lines are drown by 2 nested contours.
      </NLi>
      <NLi>
        Join all contours to a single outline. This is the last and the most important step. Usually
        editors automatically set the correct contour direction depending on nesting and black
        fills.
      </NLi>
    </NOl>
  </NModal>
</template>

<script lang="ts" setup>
  import { NModal, NOl, NLi, NP } from 'naive-ui'
  import { computed } from 'vue'

  export interface Props {
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
</script>

<style lang="scss">
  .draw-tips {
    &__modal {
      --n-bezier-ease-out: cubic-bezier(0.76, 0, 0.24, 1);
      width: 500px;
      background: var(--modal-bg) !important;
      overflow: hidden;
      * {
        color: var(--main-color) !important;
      }
    }
  }
</style>
