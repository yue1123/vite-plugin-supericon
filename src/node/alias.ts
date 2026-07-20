import { isAbsolute, resolve } from 'path'
import type { AliasOptions, Alias } from 'vite'

export function normalizeAlias(alias?: AliasOptions): Alias[] {
  if (!alias) return []
  if (Array.isArray(alias)) return alias
  return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))
}

function matches(find: string | RegExp, id: string): boolean {
  if (find instanceof RegExp) return find.test(id)
  if (id === find) return true
  return id.startsWith(find) && id[find.length] === '/'
}

export function applyAlias(id: string, aliases: Alias[], root: string): string {
  for (const { find, replacement } of aliases) {
    if (matches(find, id)) {
      const out = id.replace(find, replacement)
      return isAbsolute(out) ? out : resolve(root, out)
    }
  }
  return resolve(root, id)
}

export function resolveAlias(id: string, aliases: AliasOptions, root: string) {
  return applyAlias(id, normalizeAlias(aliases), root)
}
