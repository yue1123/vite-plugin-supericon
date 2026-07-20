<template>
  <NConfigProvider :theme="theme" :hljs="hljs" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <Main />
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { NMessageProvider, NConfigProvider, darkTheme } from 'naive-ui'
import Main from './views/Main.vue'
import { isDark } from './logic'
import { themeOverrides, currentCssVars } from './logic/theme'
import hljs from 'highlight.js/lib/core'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
console.log(1)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)

const theme = computed(() => (isDark.value ? darkTheme : null))

/**
 * Apply CSS variables to :root so that ALL stylesheets — Tailwind utilities,
 * scoped component styles, AND globally-defined rules like body { background-image: var(--backdrop-grain) } —
 * pick them up. Reactive to both isDark and iconStyle through currentCssVars.
 */
if (typeof document !== 'undefined') {
  watchEffect(() => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(currentCssVars.value)) {
      root.style.setProperty(name, value)
    }
  })
}
</script>
