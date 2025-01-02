import { createHotContext } from 'vite-hot-client'

const hotContext = createHotContext(
  '/___',
  `${location.pathname.split('/__supericon')[0] || ''}/`.replace(/\/\//g, '/')
)
export async function getHot() {
  return await hotContext
}
