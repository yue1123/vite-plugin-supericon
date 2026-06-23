<template>
  <nav class="flex items-center justify-between gap-4 py-3.5">
    <!-- Brand -->
    <div class="flex items-center gap-2.5">
      <span aria-hidden="true" class="nav-logo">
        <Icon icon="material-symbols:bolt" />
      </span>
      <h1 class="font-display text-2xl font-bold tracking-tight text-fg">SuperIcon</h1>
      <NTag :bordered="false" round size="small" class="nav-version font-mono">v1.1.0</NTag>
    </div>

    <!-- Segmented nav -->
    <div
      class="ml-auto mr-3 flex items-center gap-1 p-1 rounded-full bg-sunken border border-line-subtle"
    >
      <button
        class="nav-link inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm transition-colors duration-150"
        :class="
          page === 'library'
            ? 'bg-canvas text-accent-active shadow-sm font-medium'
            : 'text-fg-muted hover:bg-surface'
        "
        @click="page = 'library'"
      >
        <Icon icon="material-symbols:grid-view-outline-rounded" />
        <span>图标</span>
      </button>
      <button
        class="nav-link inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm transition-colors duration-150"
        :class="
          page === 'help'
            ? 'bg-canvas text-accent-active shadow-sm font-medium'
            : 'text-fg-muted hover:bg-surface'
        "
        @click="page = 'help'"
      >
        <Icon icon="material-symbols:help-outline-rounded" variant="outline" />
        <span>帮助</span>
      </button>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <ThemeToggleBtn />
      <Button ghost @click="gotoGithub" title="Star on GitHub">
        <Icon icon="simple-icons:github" />
      </Button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { NTag } from 'naive-ui'
import Button from '../components/Button.vue'
import ThemeToggleBtn from '../components/ThemeToggleBtn.vue'
import { page } from '../logic'
import { Icon } from '@iconify/vue'

function gotoGithub() {
  window.open('https://github.com/yue1123/vite-plugin-supericon')
}
</script>

<style scoped>
/* Brand logo: background driven by --grad token so it swaps between
   the Vite gradient and the Mono solid color automatically. */
.nav-logo {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--text-on-accent);
  font-size: 20px;
  background: var(--grad);
  box-shadow: var(--shadow-accent);
}
</style>
