<template>
  <div
    class="aspect-square min-h-23 flex flex-col items-center justify-around gap-2.5 px-2.5 pt-3.5 pb-8 rounded-[14px] border border-line"
  >
    <NSkeleton width="34px" height="34px" />
    <NSkeleton width="80%" height="11px" />
  </div>
</template>

<script setup lang="ts">
import { NSkeleton } from 'naive-ui'
</script>
