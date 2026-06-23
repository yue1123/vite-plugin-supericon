import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { superIcon } from 'vite-plugin-supericon'

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      superIcon({
        font: { dir: './src/assets/icons', name: 'my-icons' },
        svg: { dir: './src/assets/svgicons' }
      })
    ],
    server: {}
  }
})
