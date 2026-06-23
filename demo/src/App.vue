<script setup lang="ts">
  import HelloWorld from './components/HelloWorld.vue'
  console.log('app中打印', import.meta.env.VITE_APP_DEBUG)
  console.log('app中打印env', import.meta.env)
</script>

<template>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <HelloWorld msg="Vite + Vue" />

  <div style="display:flex; gap:16px; align-items:center; padding:16px">
    <span>sprite:</span>
    <svg width="48" height="48"><use href="#icon-multi-heart" /></svg>
    <svg width="48" height="48"><use href="#icon-logo-demo" /></svg>
    <span>font:</span>
    <i class="my-icons" style="font-size:48px"></i>
  </div>

  <hr />
  <h1>iconfont</h1>
  <i class="icon-desk-info"></i>
  <i class="icon-chat"></i>
  <i class="icon-check"></i>
</template>

<style scoped>
  .logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
  }
  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
  .logo.vue:hover {
    filter: drop-shadow(0 0 2em #42b883aa);
  }
</style>
