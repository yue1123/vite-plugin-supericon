# vite-plugin-supericon

![npm](https://img.shields.io/npm/v/vite-plugin-supericon?style=flat-square)
![npm](https://img.shields.io/npm/dm/vite-plugin-supericon?style=flat-square)
![GitHub](https://img.shields.io/github/license/yue1123/vite-plugin-supericon?style=flat-square)

[English](./README.md)

将项目中的 svg 纯色图标转换为字体图标, 并提供交互界面. 核心由 [fantasticon](https://github.com/tancredi/fantasticon#readme) 实现.

## 📦 Install

```shell
npm i vite-plugin-supericon -D

# yarn
yarn add vite-plugin-supericon -D

# pnpm
pnpm add vite-plugin-supericon -D
```

## 🦄 Usage

1. 添加并配置 superIcon 插件到 `vite.config.js` / `vite.config.ts`

```ts
// vite.config.js / vite.config.ts
import { superIcon } from 'vite-plugin-supericon'

export default {
  plugins: [
    superIcon({
      srcDir: './src/assets/icons'
    })
  ]
}
```

2. 在入口文件中引入模块

```ts
// main.ts / main.js
import 'virtual:supericon'
```

3. 然后运行服务, 通过终端点击链接或直接打开 `localhost:5173/__supericon/` 访问交互式界面

> 完整使用 demo 可参考 [demo](./demo/)

## options

| 属性名     | 属性类型 | 是否可选 | 默认值             | 属性描述                       |
| ---------- | -------- | -------- | ------------------ | ------------------------------ |
| clearCache | boolean  | 是       | true               | 在服务器启动前清除缓存         |
| watch      | boolean  | 是       | true               | 监视 srcDir 文件变化           |
| base       | string   | 是       | 从 Vite 配置中读取 | 超级图标 UI 的基础 URL         |
| open       | boolean  | 是       | false              | 自动在浏览器中打开超级图标页面 |
| silent     | boolean  | 是       | false              | 在终端中静默打印 URL 输出      |
| srcDir     | string   | 否       |                    | SVG 图标源文件夹               |
| name       | string   | 是       | iconfont           | 图标字体的名称                 |
| prefix     | string   | 是       | icon               | 图标 CSS 类前缀                |

## License

[MIT licenses](https://opensource.org/licenses/MIT)
