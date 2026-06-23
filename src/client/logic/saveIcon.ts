import { getHot } from './getHot'

/**
 * Persist a (repaired) SVG back to its source file via the dev server.
 * The server writes the file; its watcher then regenerates the font and pushes
 * an update, so the preview refreshes automatically.
 */
export async function saveIconSvg(absolutePath: string, svg: string): Promise<void> {
  const hot = await getHot()
  if (!hot) throw new Error('[supericon] hot context unavailable')
  hot.send('vite-plugin-supericon:save', { absolutePath, svg })
}
