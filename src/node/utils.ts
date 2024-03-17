import c from 'picocolors'

export async function openBrowser(address: string) {
  await import('open').then((r) => r.default(address, { newInstance: true })).catch(() => {})
}

export function colorUrl(url: string) {
  return c.green(url.replace(/:(\d+)\//, (_, port) => `:${c.bold(port)}/`))
}

export function debounce<T extends any[], U>(
  fn: (...arg: T) => U,
  wait: number = 300,
  immediate: boolean = false
) {
  let timer: NodeJS.Timeout | null = null
  return function proxy(this: any, ...arg: T) {
    let _this = this
    let _immediate = immediate && !timer
    timer && clearTimeout(timer)
    timer = setTimeout(() => {
      !immediate && fn.apply(_this, arg)
      timer = null
    }, wait)
    _immediate && fn.apply(_this, arg)
  }
}

export function warn(message: string) {
  return console.warn(c.yellow('[vite-plugin-supericon]'), c.yellow(message))
}

export function error(message: string) {
  return console.warn(c.red('[vite-plugin-supericon]'), c.red(message))
}
