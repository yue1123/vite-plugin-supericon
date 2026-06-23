# `src/node` 待办清单

针对 `src/node/` 当前实现整理的改进项。按影响优先级排序,P0 最紧急。

---

## P0 — 影响功能正确性

- [ ] **修复 `generateFonts` 失败时 Promise 永挂**
  - 位置:`src/node/fontsGenerator.ts:95`
  - 现象:`.catch` 里只打印日志,既不 `resolve` 也不 `reject`,`promise` 永远 pending。非 `force` 调用会直接返回这个死 Promise,一次报错把整个生成链路锁死。
  - 方向:在 catch 里 `resolve([])` 或 `reject(err)`,并在 `run()` 内部捕获后清空 `promise` 缓存,允许下次重新尝试。

- [ ] **`load()` 返回的相对路径不可靠**
  - 位置:`src/node/index.ts:150`
  - 现象:`@import './node_modules/.supericon/${name}.css'`,在 monorepo / 非默认 `node_modules` 位置会找不到。字符串拼接也未用 `path.join`。
  - 方向:改用 `distDir` 绝对路径,或交由 Vite 解析(走 cacheDir / `this.resolve`)。

- [ ] **`run(force=true)` 存在竞态**
  - 位置:`src/node/fontsGenerator.ts:33`
  - 现象:旧 Promise 不取消,`writeFileSync` + `resolve` 仍会执行,可能出现旧数据覆盖新数据。
  - 方向:引入 `generationId`,只接受最新一次的结果;或者用 AbortController 包裹。

- [ ] **`srcDir` 未传时直接崩溃**
  - 位置:`src/node/index.ts:114`
  - 现象:`_srcDir.includes(aliasKey)` 在 `_srcDir` 为 undefined 时抛 `Cannot read properties of undefined`。
  - 方向:在入口处校验必填项,缺失时友好报错。

---

## P1 — 路径 / 构建确定性

- [ ] **`distDir` 用 `process.cwd()` 而不是 Vite root**
  - 位置:`src/node/index.ts:34`
  - 现象:启动目录与 Vite root 不一致时定位错误。
  - 方向:在 `configResolved` 里改用 `config.cacheDir`(更符合 Vite 生态)或 `config.root`。

- [ ] **`iconify.json` 写入 `Date.now()` 破坏构建确定性**
  - 位置:`src/node/fontsGenerator.ts:64`
  - 现象:每次生成产物都不同,影响缓存命中 / diff。
  - 方向:用源文件 mtime 的最大值,或干脆移除该字段。

- [ ] **生产构建未走 Vite asset pipeline**
  - 位置:`src/node/index.ts` 整体设计
  - 现象:字体文件没经过 Vite hash / fingerprint,部署到 CDN 会有缓存问题。
  - 方向:把产物作为 emit asset 注册,或者改用 `import.meta.glob` 把 svg 在构建时直接打包。

---

## P2 — 资源清理 & 监听器

- [ ] **watcher / printUrls 未清理**
  - 位置:`src/node/index.ts:55-60`, `74-100`
  - 现象:`server.watcher.on(...)` 未保留引用,server close 时不移除;`server.printUrls` 被覆盖后未恢复。HMR 重启会叠加。
  - 方向:用 `buildEnd` / `closeBundle` 钩子做清理,保留 listener 引用以便 `off`。

- [ ] **`base` 在中间件挂载和 URL 打印之间不对称**
  - 位置:`src/node/index.ts:40` vs `:81`
  - 现象:挂载用 `options.base ?? server.config.base`,打印 URL 又重新读 `server.config.base`,用户传 `options.base` 时打印的链接会失效。
  - 方向:抽出统一变量。

---

## P3 — 健壮性 & 性能

- [ ] **SVG 内容解析脆弱**
  - 位置:`src/node/fontsGenerator.ts:71-74` + `src/node/constants.ts:8`
  - 现象:`.replace('\n', '')` 只替换第一个;`SVG_TAG_REG` 用贪婪正则,遇到注释 / CDATA / 内嵌 svg 会出错。
  - 方向:用更严谨的解析器(`htmlparser2` / `svg-parser`),或至少 `replace(/\n/g, '')`。

- [ ] **重复磁盘 IO**
  - 位置:`src/node/fontsGenerator.ts:68-89`
  - 现象:fantasticon 内部已经读过 svg,这里又 `readFileSync` + `statSync`;`writeFileSync(iconify.json)` 是同步 IO,挂在 dev server 主线程。
  - 方向:复用 fantasticon 暴露的数据;`iconify.json` 改成异步写。

- [ ] **`debounce` 吞掉 `force` 参数 / 无返回值**
  - 位置:`src/node/index.ts:45` + `src/node/utils.ts:11`
  - 现象:多次调用只保留最后一次 `force`;`regenerateFont` 无返回值无法 await。
  - 方向:语义上分两个函数(`scheduleRegenerate(force)` 内部聚合),或改用 trailing-only debounce 并 return promise。

---

## P4 — 清理 / 风格

- [ ] **`isDev` 判断冗余**:`configureServer` 只在 dev 触发,`if (isDev)` 永真,可删。位置 `src/node/index.ts:107,138`。
- [ ] **`utils.ts` 的 `error()` 实际用了 `console.warn`**,应改为 `console.error`。位置 `src/node/utils.ts:33`。
- [ ] **常量写法**:`'\0' + 'virtual-supericon.css'` 可直接写 `'\0virtual-supericon.css'`。位置 `src/node/constants.ts:5`。
- [ ] **死代码注释**:`// , OtherAssetType.TS` 可清理。位置 `src/node/fontsGenerator.ts:54`。
- [ ] **`// @ts-ignore` 跳过 alias 类型**:补全类型。位置 `src/node/index.ts:115`。
- [ ] **`name` 未做文件名合法性校验**:无效字符会导致写文件失败。位置 `src/node/index.ts:27`。
