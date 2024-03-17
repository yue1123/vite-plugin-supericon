<template>
  <button
    class="button"
    type="button"
    :class="{ ghost: props.ghost }"
    :style="{ fontSize: `${sizeNumber}px` }"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  export type ButtonSize = 'small' | 'medium' | 'large'
  export interface Props {
    /** ghost button, no background */
    ghost?: boolean
    /** size */
    size?: ButtonSize
  }
  const props = withDefaults(defineProps<Props>(), {
    ghost: false,
    size: 'medium'
  })
  const sizeMap: Record<ButtonSize, number> = {
    small: 13,
    medium: 16,
    large: 18
  }
  const sizeNumber = computed(() => sizeMap[props.size])
</script>

<style lang="scss">
  .button {
    cursor: pointer;
    padding: 5px 10px;
    flex: 1;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    outline: none;
    position: relative;
    z-index: auto;
    border: none;
    display: inline-flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    user-select: none;
    -webkit-user-select: none;
    text-align: center;
    text-decoration: none;
    transition: background 0.3s;

    &.ghost {
      background: transparent !important;
    }
    svg {
      margin: 0px 1px;
      color: var(--main-color);
    }
    &:hover,
    &:focus-within {
      background: var(--base-bg);
      svg {
        color: var(--hover-color);
      }
    }
  }
</style>
