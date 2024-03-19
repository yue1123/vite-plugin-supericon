import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { superIcon } from '../node'
import { resolve } from 'node:path'
import Inspect from 'vite-plugin-inspect'

export default defineConfig(() => {
  return {
    base: './',

    resolve: {
      alias: {
        '@': __dirname
      }
    },
    plugins: [
      vue(),
      Inspect(),
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
