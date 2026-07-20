<template>
  <div class="loading-skeleton">
    <div class="flex items-center justify-between gap-2 mb-5">
      <NSkeleton height="34px" width="120px" />
      <NSkeleton height="34px" width="240px" />
    </div>
    <div class="icon-grid" :style="gridStyle">
      <div
        v-for="i in 16"
        :key="i"
        class="aspect-square min-h-23 flex flex-col items-center justify-around gap-2.5 px-2.5 pt-3.5 pb-8 rounded-[14px] border border-line"
      >
        <NSkeleton width="34px" height="34px" />
        <NSkeleton width="80%" height="11px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NSkeleton } from 'naive-ui'
import { computed } from 'vue'
import { density } from '../logic'

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${density.value}, minmax(0, 1fr))`
}))
</script>
