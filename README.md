# vite-plugin-supericon

![icon list](./screenshots/icon-list.jpg)

![npm](https://img.shields.io/npm/v/vite-plugin-supericon?style=flat-square)
![npm](https://img.shields.io/npm/dm/vite-plugin-supericon?style=flat-square)
![GitHub](https://img.shields.io/github/license/yue1123/vite-plugin-supericon?style=flat-square)

[中文](./README.zh.md)

Converts svg solid colour icons in a project to font icons and provides an interactive interface. The core is implemented by [fantasticon](https://github.com/tancredi/fantasticon#readme).

## ✨ Features

1. Easily configurable with just one line.
2. Automatically converts SVG to Iconfont.
3. Provides a beautiful interactive user interface.
4. Quick copy icon code functionality.
5. Supports comparison between original and rendered images, allowing for quick difference checking.
6. Intelligent prompting for duplicate icons.
7. Multiple icon sorting and filtering options.
8. Supports previewing generated icons in VSCode [Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify).

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

## 😀 Iconify IntelliSense Support

Configure vscode settings for the workspace.

```json
// .vscode/setting.json
{
  "iconify.customCollectionJsonPaths": ["node_modules/.supericon/iconify.json"]
}
```

## Options

| Property    | Type    | Partial | Default                 | Description                                                                                               |
| ----------- | ------- | ------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| srcDir      | string  | no      |                         | Svg icons source folder.                                                                                  |
| base        | string  | yes     | read from Vite's config | Base URL for superIcon UI                                                                                 |
| clearCache  | boolean | yes     | `true`                    | clear cache pre server start                                                                              |
| watch       | boolean | yes     | `true`                    | Watch srcDir files change                                                                                 |
| open        | boolean | yes     | `false`                   | Automatically open super icon page in browser                                                             |
| silent      | boolean | yes     | `false`                   | Print URL output silently in the terminal                                                                 |
| name        | string  | yes     | `iconfont`                | Name of icons font                                                                                        |
| prefix      | string  | yes     | `icon`                    | Icon css class prefix                                                                                     |
| fontHeight  | number  | yes     | `300`                    | the output font height (icons will be scaled so the highest has this height)                              |
| descent     | number  | yes     |                         | font descent                                                                                              |
| round       | number  | yes     | `icon`                    | setup the SVG path rounding [10e12]                                                                       |
| selector    | string  | yes     | `null`                    | use a CSS selector instead of 'tag + prefix'                                                              |
| tag         | string  | yes      | `null`                  | CSS base tag for icons                                                                                    |
| cssTemplate | string  | yes      | `i`                     | Use a custom[Handlebars](https://handlebarsjs.com/)template file to generate css file(template file path) |
| normalize   | boolean | yes      | `true`                  | normalize icons by scaling them to the height of the highest icon                                         |

## License

[MIT licenses](https://opensource.org/licenses/MIT)
