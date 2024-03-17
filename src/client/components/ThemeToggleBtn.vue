<template>
  <Button ghost size="large" @click="toggleDark()">
    <transition
      mode="out-in"
      enter-active-class="animated animate__rotateIn"
      leave-active-class="animated animate__rotateOut"
    >
      <Icon v-if="isDark" icon="bi:moon"></Icon>
      <Icon v-else icon="bi:sun"></Icon>
    </transition>
  </Button>
</template>

<script lang="ts" setup>
  import { isDark, toggleDark } from '../logic'
  import { NButton } from 'naive-ui'
  import { Icon } from '@iconify/vue'

  import Button from './Button.vue'
</script>

<script lang="ts">
  export default {
    name: 'ThemeButton'
  }
</script>
