<template>
  <NPopover trigger="click" class="setting-popover" placement="bottom" raw>
    <template #trigger>
      <Button title="Appearance Setting" ghost size="large">
        <Icon icon="bi:gear"></Icon>
      </Button>
    </template>
    <template #header>
      <span>Appearance</span>
    </template>
    <div class="setting-cell">
      <div class="setting-cell__name">Show Prefix:</div>
      <NSwitch size="small" v-model:value="isShowPrefix"></NSwitch>
    </div>
    <div class="setting-cell">
      <div class="setting-cell__name">Layout:</div>
      <NRadioGroup size="small" class="radio-group" v-model:value="iconSize" name="iconSize">
        <NRadioButton v-for="size in iconSizes" :key="size" :value="size">
          {{ size }}
        </NRadioButton>
      </NRadioGroup>
    </div>
    <div class="setting-cell">
      <div class="setting-cell__name">Copy:</div>
      <NRadioGroup size="small" class="radio-group" v-model:value="copyTagType" name="copyTagType">
        <NRadioButton v-for="tagType in copyTagTypes" :key="tagType" :value="tagType">{{ tagType }} Tag</NRadioButton>
      </NRadioGroup>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
  import { NRadioGroup, NPopover, NSwitch, NRadioButton } from 'naive-ui'
  import { Icon } from '@iconify/vue'
  import { iconSizes, iconSize, copyTagType, copyTagTypes, isShowPrefix } from '../../logic'
  import Button from '../../components/Button.vue'
</script>
<style lang="scss">
  .setting-popover {
    background: var(--n-color);
    padding: 10px 0;
    border-radius: 4px;

    .radio-divider {
      margin: 10px 0;
    }
    .setting-cell {
      &__name {
        margin-bottom: 5px;
      }
    }
    .setting-cell + .setting-cell {
      margin-top: 10px;
    }
  }
</style>
