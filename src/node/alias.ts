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
  // 对齐 Vite 的 withTrailingSlash 语义:key 自带尾斜杠(如 '@/')时直接前缀匹配,
  // 否则要求其后紧跟 '/'。旧实现对尾斜杠 key 恒不匹配 → 静默生成 0 图标。
  return id.startsWith(find.endsWith('/') ? find : find + '/')
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
