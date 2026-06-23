/**
 * THEME TOKENS — single source of truth.
 *
 *   themes[style][mode]  ∈  Vite/Mono × dark/light
 *
 * Consumed in two places (both derive from the SAME object):
 *
 *   1) Naive UI `themeOverrides`   (see logic/theme.ts)
 *   2) CSS variables on :root      (see App.vue → watchEffect → documentElement.style.setProperty)
 *
 * Switching `iconStyle` or `isDark` re-evaluates both outputs simultaneously,
 * so Naive's primary/hover/pressed colors and our own `var(--…)` consumers
 * always stay in lock-step.
 */

export type IconStyleId = 'vite' | 'mono'
export type Mode = 'light' | 'dark'

export interface ThemeTokens {
  /* Surface */
  'bg-base': string
  'bg-surface': string
  'bg-sunken': string
  'bg-elevated': string

  /* Border */
  'border-subtle': string
  'border-default': string
  'border-strong': string

  /* Text */
  'text-primary': string
  'text-secondary': string
  'text-muted': string
  'text-on-accent': string

  /* Accent + derivations */
  accent: string
  'accent-hover': string
  'accent-active': string
  'accent-2': string
  'accent-soft': string
  'accent-soft-hover': string
  'accent-ring': string

  /* Status */
  warn: string
  'warn-soft': string
  danger: string

  /* Hero / brand surfaces */
  grad: string
  glass: string
  inset: string

  /* Elevation */
  'shadow-sm': string
  'shadow-md': string
  'shadow-lg': string
  'shadow-accent': string

  /* Decorative app-shell gradient (driven by --mint-* raw palette in tokens.css) */
  'backdrop-grain': string
}

const lightBackdrop =
  'radial-gradient(1200px 600px at 80% -10%, color-mix(in srgb, var(--mint-200) 55%, transparent), transparent 60%),' +
  'radial-gradient(900px 500px at -10% 110%, color-mix(in srgb, var(--mint-100) 70%, transparent), transparent 60%)'

const darkBackdrop =
  'radial-gradient(1200px 600px at 80% -10%, color-mix(in srgb, var(--mint-800) 35%, transparent), transparent 60%),' +
  'radial-gradient(900px 500px at -10% 110%, color-mix(in srgb, var(--mint-900) 60%, transparent), transparent 60%)'

export const light: ThemeTokens = {
  'bg-base': '#f5f7f7',
  'bg-surface': '#ffffff',
  'bg-sunken': '#f0f3f3',
  'bg-elevated': '#ffffff',

  'border-subtle': 'rgba(17, 24, 21, 0.05)',
  'border-default': '#e8ebeb',
  'border-strong': '#d8dcdc',

  'text-primary': '#1a1c1d',
  'text-secondary': '#5b6063',
  'text-muted': '#9499a0',
  'text-on-accent': '#ffffff',

  accent: '#18a058',
  'accent-hover': '#36ad6a',
  'accent-active': '#137b44',
  'accent-2': '#36ad6a',
  'accent-soft': 'rgba(24, 160, 88, 0.1)',
  'accent-soft-hover': 'rgba(24, 160, 88, 0.16)',
  'accent-ring': 'rgba(24, 160, 88, 0.28)',

  warn: '#b45309',
  'warn-soft': 'rgba(180, 83, 9, 0.09)',
  danger: '#c84b5e',

  grad: 'linear-gradient(120deg, #18a058, #63e2b7)',
  glass: 'color-mix(in srgb, #ffffff 68%, transparent)',
  inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.6)',

  'shadow-sm': '0 1px 2px rgba(17, 24, 21, 0.05)',
  'shadow-md': '0 12px 32px -10px rgba(17, 24, 21, 0.13), 0 3px 10px -4px rgba(17, 24, 21, 0.07)',
  'shadow-lg': '0 30px 70px -16px rgba(17, 24, 21, 0.22)',
  'shadow-accent': '0 8px 24px -6px color-mix(in srgb, #18a058 35%, transparent)',

  'backdrop-grain': lightBackdrop
}

/* ─── Vite · Dark ─── */
export const dark: ThemeTokens = {
  'bg-base': '#080b0a',
  'bg-surface': '#121815',
  'bg-sunken': '#19211d',
  'bg-elevated': '#0c100e',

  'border-subtle': 'rgba(255, 255, 255, 0.06)',
  'border-default': 'rgba(255, 255, 255, 0.08)',
  'border-strong': 'rgba(255, 255, 255, 0.16)',

  'text-primary': '#f1f3f4',
  'text-secondary': '#9ba0a3',
  'text-muted': '#61666a',
  'text-on-accent': '#04231a',

  accent: '#63e2b7',
  'accent-hover': '#7eebc9',
  'accent-active': '#36d399',
  'accent-2': '#36d399',
  'accent-soft': 'rgba(99, 226, 183, 0.16)',
  'accent-soft-hover': 'rgba(99, 226, 183, 0.22)',
  'accent-ring': 'rgba(99, 226, 183, 0.35)',

  warn: '#ffb224',
  'warn-soft': 'rgba(255, 178, 36, 0.13)',
  danger: '#c84b5e',

  grad: 'linear-gradient(120deg, #36d399, #63e2b7)',
  glass: 'color-mix(in srgb, #0c100e 70%, transparent)',
  inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',

  'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
  'shadow-md': '0 10px 30px -8px rgba(0, 0, 0, 0.62), 0 2px 8px -3px rgba(0, 0, 0, 0.5)',
  'shadow-lg': '0 36px 80px -20px rgba(0, 0, 0, 0.78)',
  'shadow-accent': '0 8px 24px -6px color-mix(in srgb, #36d399 30%, transparent)',

  'backdrop-grain': darkBackdrop
}

/** Project a token bag into a CSS variable record (--prefixed keys). */
export function tokensToCssVars(t: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k in t) out[`--${k}`] = t[k as keyof ThemeTokens]
  return out
}
