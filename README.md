# vite-plugin-supericon

![npm](https://img.shields.io/npm/v/vite-plugin-supericon?style=flat-square)
![npm](https://img.shields.io/npm/dm/vite-plugin-supericon?style=flat-square)
![GitHub](https://img.shields.io/github/license/yue1123/vite-plugin-supericon?style=flat-square)

[English](./README.md)

Converts svg solid colour icons in a project to font icons and provides an interactive interface. The core is implemented by [fantasticon](https://github.com/tancredi/fantasticon#readme).

## 📦 Install

```shell
npm i vite-plugin-supericon -D

# yarn
yarn add vite-plugin-supericon -D

# pnpm
pnpm add vite-plugin-supericon -D
```

## 🦄 Usage

1. Add and configure the superIcon plugin to `vite.config.js` / `vite.config.ts`.

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

2. Introducing modules in the entry file

```ts
// main.ts / main.js
import 'virtual:supericon'
```

3. Then run the service, click on the link in the terminal or open `localhost:5173/__supericon/` to access the interactive interface.

> The full demo can be found at [demo](./demo/)
## options

| Property   | Type    | Partial | Default                 | Description                                   |
| ---------- | ------- | ------- | ----------------------- | --------------------------------------------- |
| srcDir     | string  | 否      |                         | Svg icons source folder.                      |
| base       | string  | 是      | read from Vite's config | Base URL for superIcon UI                     |
| clearCache | boolean | 是      | true                    | clear cache pre server start                  |
| watch      | boolean | 是      | true                    | Watch srcDir files change                     |
| open       | boolean | 是      | false                   | Automatically open super icon page in browser |
| silent     | boolean | 是      | false                   | Print URL output silently in the terminal     |
| name       | string  | 是      | iconfont                | Name of icons font                            |
| prefix     | string  | 是      | icon                    | Icon css class prefix                         |

## License

[MIT licenses](https://opensource.org/licenses/MIT)
