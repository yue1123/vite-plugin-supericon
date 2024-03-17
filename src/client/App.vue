<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <Main />
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
  import { GlobalThemeOverrides, NMessageProvider, NConfigProvider } from 'naive-ui'
  import Main from './views/Main.vue'
  import { computed } from 'vue'
  import { isDark } from './logic'

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    return {
      common: {
        primaryColor: '#3c4859',
        cubicBezierEaseOut: 'cubic-bezier(0.76, 0, 0.24, 1)'
      },
      Input: {
        color: 'transparent',
        colorFocus: 'transparent',
        placeholderColor: 'var(--main-color)',
        textColor: 'var(--base-text-color)',
        suffixTextColor: 'var(--main-color)',
        caretColor: 'var(--hover-color)',
        border: '1px solid var(--main-bg)',
        borderHover: '1px solid var(--hover-color)',
        borderFocus: '1px solid var(--hover-color)'
      },
      Popover: {
        textColor: '#3c4859'
      },
      Divider: {
        color: 'var(--main-bg)'
      },
      Skeleton: {
        color: isDark.value ? 'rgba(255, 255, 255, 0.12)' : '#eee',
        colorEnd: isDark.value ? 'rgba(255, 255, 255, 0.18)' : '#ddd'
      }
    }
  })
</script>
