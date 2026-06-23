import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { superIcon } from '../node'
import { resolve } from 'node:path'
import Inspect from 'vite-plugin-inspect'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(() => {
  return {
    base: './',

    resolve: {
      alias: {
        '@': __dirname
      }
    },
    define:{
      __VERSION__: JSON.stringify(process.env.npm_package_version)
    },
    plugins: [
      vue(),
      tailwindcss(),
      Inspect(),
      superIcon({
        font: { dir: './demo/src/assets/icons' },
        svg: { dir: './demo/src/assets/svgicons' }
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
