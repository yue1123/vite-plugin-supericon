<template>
  <div class="header">
    <div class="header__left">
      <h1 class="header__title">SuperIcon</h1>
      <a
        title="Drawing Rules"
        target="_blank"
        href="https://www.iconfont.cn/help/detail?spm=a313x.help_article_detail.i1.de97f49b6.68803a81iRoXjB&helptype=draw"
      >
        <Icon icon="bi:question-circle"></Icon>
      </a>
    </div>
    <div class="header__right">
      <NInput class="search-input" placeholder="Search..." clearable v-model:value="searchText">
        <template #prefix>
          <Icon icon="gg:search" />
        </template>
      </NInput>
      <div class="buttons">
        <Button title="Sort Mode" ghost size="large" @click="toggleSort">
          <Icon v-if="sortMode === 'default'" icon="bi:sort-alpha-down"></Icon>
          <Icon v-else icon="bi:calendar2"></Icon>
        </Button>
        <NDivider vertical />
        <Appearance />
        <NDivider vertical />
        <Button title="GitHub" ghost size="large">
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
</template>

<script setup lang="ts">
  import { NInput, NSkeleton, NDivider } from 'naive-ui'
  import { Icon } from '@iconify/vue'
  import { searchText, isLoading, iconCount, sortMode, toggleSort } from '../logic'
  import Button from '../components/Button.vue'
  import ThemeToggleBtn from '../components/ThemeToggleBtn.vue'
  import Appearance from './Appearance/index.vue'
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
      a {
        display: inline-block;
        font-size: 16px;
        color: var(--main-color);
        margin-left: 10px;
        &:hover {
          color: var(--hover-color);
        }
      }
    }

    &__title {
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
