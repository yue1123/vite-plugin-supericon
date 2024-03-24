<template>
  <div class="header">
    <div class="header__left">
      <h1 class="header__title">SuperIcon</h1>
    </div>
    <div class="header__right">
      <NInput class="search-input" placeholder="Search..." clearable v-model:value="searchText">
        <template #prefix>
          <Icon icon="gg:search" />
        </template>
      </NInput>
      <div class="buttons">
        <Button title="Sort Mode" ghost size="large" @click="toggleSort">
          <Icon v-show="sortMode === 'default'" icon="bi:sort-alpha-down"></Icon>
          <Icon v-show="sortMode === 'date'" icon="gg:calendar-dates"></Icon>
        </Button>
        <NDivider vertical />
        <Appearance />
        <NDivider vertical />

        <Button title="GitHub" ghost size="large" @click="showTips = true">
          <Icon icon="bi:question-circle"></Icon>
        </Button>
        <Button title="GitHub" ghost size="large" @click="gotoGithub">
          <Icon icon="bi:github"></Icon>
        </Button>
        <ThemeToggleBtn />
      </div>
    </div>
  </div>
  <div class="icon-count">
    <NSkeleton width="150px" v-if="isLoading" />
    <span v-else>{{ iconCount }} icons in total.</span>
  </div>
  <TipsModal v-model:show="showTips"></TipsModal>
</template>

<script setup lang="ts">
  import { NInput, NSkeleton, NDivider } from 'naive-ui'
  import { Icon } from '@iconify/vue'
  import { searchText, isLoading, iconCount, sortMode, toggleSort } from '../logic'
  import Button from '../components/Button.vue'
  import ThemeToggleBtn from '../components/ThemeToggleBtn.vue'
  import Appearance from './Appearance/index.vue'
  import TipsModal from './TipsModal/index.vue'
  import { ref } from 'vue'

  const showTips = ref(false)
  function gotoGithub() {
    window.open('https://github.com/yue1123/vite-plugin-supericon')
  }
</script>

<style lang="scss">
  .header {
    display: flex;
    padding: 10px 0;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    position: sticky;
    top: 0;
    background: var(--bg);
    z-index: 10;

    &__left {
      display: flex;
      align-items: center;
      padding-right: 30px;
      line-height: 1;
    }
    &__title {
      font-family: 'Comfortaa', sans-serif;
      font-weight: 600;
    }

    &__right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0 25px;
      flex: 1;
      .search-input {
        max-width: 200px;
        min-width: 130px;
      }
      .buttons {
        display: flex;
        align-items: center;
        gap: 0 2px;
      }
    }
  }
  .icon-count {
    margin-bottom: 15px;
  }
</style>
