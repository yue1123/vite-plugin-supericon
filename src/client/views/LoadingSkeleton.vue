<template>
  <div class="skeleton">
    <NSkeleton width="30px" height="30px" />
    <NSkeleton width="100%" height="20px" />
  </div>
</template>

<script setup lang="ts">
  import { NSkeleton } from 'naive-ui'
</script>

<style lang="scss">
  .skeleton {
    padding: 15px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
  }
</style>
