import { createHotContext } from 'vite-hot-client'

export const baseUrl = `${location.pathname.split('/__supericon')[0] || ''}/`.replace(/\/\//g, '/')

const hotContext = createHotContext('/___', baseUrl)
export async function getHot() {
  return await hotContext
}
