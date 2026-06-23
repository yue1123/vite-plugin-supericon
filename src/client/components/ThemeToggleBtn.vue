<template>
  <Button ghost @click="toggleDark()" :title="isDark ? 'Switch to light' : 'Switch to dark'">
    <Transition
      mode="out-in"
      enter-active-class="animated animate__rotateIn"
      leave-active-class="animated animate__rotateOut"
    >
      <Icon v-if="isDark" icon="material-symbols:dark-mode" variant="outline" />
      <Icon v-else icon="material-symbols:light-mode" variant="outline" />
    </Transition>
  </Button>
</template>

<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { isDark, toggleDark } from '../logic'
import Button from './Button.vue'
</script>
