import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { superIcon } from '../node/index.js'
import { resolve } from 'node:path'
import Inspect from 'vite-plugin-inspect'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  return {
    base: './',

    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    },
    plugins: [
      vue(),
      Inspect(),
      tailwindcss(),
      superIcon({
        srcDir: './demo/src/assets/icons'
      })
    ],
    server: {},
    optimizeDeps: {
      exclude: ['vite-hot-client']
    },
    build: {
      target: 'esnext',
      outDir: resolve(__dirname, '../../dist/client'),
      minify: true, // 'esbuild',
      emptyOutDir: true
    }
  }
})
