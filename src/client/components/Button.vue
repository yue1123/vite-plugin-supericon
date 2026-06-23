<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-transparent bg-surface text-fg-muted transition-colors duration-150 ease-out hover:bg-accent-soft hover:text-accent-active hover:border-accent-soft-hover focus-visible:bg-accent-soft focus-visible:text-accent-active active:translate-y-px"
    :class="[
      ghost && 'bg-transparent!',
      sizeClass
    ]"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type ButtonSize = 'small' | 'medium' | 'large'
export interface Props {
  ghost?: boolean
  size?: ButtonSize
}
const props = withDefaults(defineProps<Props>(), {
  ghost: false,
  size: 'medium'
})

const sizeClass = computed(() => {
  return {
    small: 'text-xs',
    medium: 'text-base',
    large: 'text-lg'
  }[props.size]
})
</script>
