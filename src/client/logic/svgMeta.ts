// FIXME:
/** Read the actual unicode codepoint the iconfont assigned, by inspecting ::before content. */
export function readUnicodeFromClass(useId: string): string | null {
  if (typeof document === 'undefined') return null
  const probe = document.createElement('i')
  probe.className = useId
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;'
  document.body.appendChild(probe)
  const raw = getComputedStyle(probe, '::before').content
  document.body.removeChild(probe)
  if (!raw || raw === 'none' || raw === 'normal') return null
  const stripped = raw.replace(/^["']|["']$/g, '')
  const cp = stripped.codePointAt(0)
  if (!cp) return null
  return cp.toString(16).toUpperCase().padStart(4, '0')
}
