import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { superIcon } from 'vite-plugin-supericon'
import inspect from 'vite-plugin-inspect'
import { join } from 'node:path'

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      inspect({}),
      superIcon({
        mode: 'import',
        font: { dir: '@/assets/icons', name: 'my-icons' },
        svg: { dir: './src/assets/svgicons' }
      })
    ],
    server: {},
    resolve: {
      alias: [{ find: '@', replacement: join(__dirname, 'src') }]
    }
  }
})
