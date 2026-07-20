import { computed } from 'vue'
import type { GlobalThemeOverrides } from 'naive-ui'
import { isDark } from './dark'
import { light, dark, tokensToCssVars, type ThemeTokens } from './tokens'

function buildOverrides(t: ThemeTokens): GlobalThemeOverrides {
  const cssVar = (n: string) => `var(${n})`
  return {
    common: {
      primaryColor: t.accent,
      primaryColorHover: t['accent-hover'],
      primaryColorPressed: t['accent-active'],
      primaryColorSuppl: t['accent-hover'],

      successColor: t.accent,
      successColorHover: t['accent-hover'],
      successColorPressed: t['accent-active'],
      successColorSuppl: t['accent-hover'],

      infoColor: t.accent,
      infoColorHover: t['accent-hover'],
      infoColorPressed: t['accent-active'],

      warningColor: t.warn,
      errorColor: t.danger,

      bodyColor: t['bg-base'],
      cardColor: t['bg-surface'],
      modalColor: t['bg-elevated'],
      popoverColor: t['bg-elevated'],
      tableColor: t['bg-surface'],
      inputColor: t['bg-surface'],
      actionColor: t['bg-sunken'],
      tagColor: t['accent-soft'],

      textColorBase: t['text-primary'],
      textColor1: t['text-primary'],
      textColor2: t['text-secondary'],
      textColor3: t['text-muted'],
      textColorDisabled: t['text-muted'],
      placeholderColor: t['text-muted'],
      iconColor: t['text-secondary'],

      borderColor: t['border-default'],
      dividerColor: t['border-subtle'],

      /* These don't participate in seemly's color derivation, so var() is safe. */
      borderRadius: cssVar('--radius-md'),
      borderRadiusSmall: cssVar('--radius-sm'),
      fontFamily: cssVar('--font-body'),
      fontFamilyMono: cssVar('--font-mono')
    },

    Button: {
      textColorPrimary: t['text-on-accent'],
      textColorHoverPrimary: t['text-on-accent'],
      textColorPressedPrimary: t['text-on-accent'],
      colorSecondary: t['accent-soft'],
      colorSecondaryHover: t['accent-soft-hover'],
      textColorSecondary: t['accent-active'],
      textColorTextHover: t.accent
    },

    Input: {
      borderRadius: cssVar('--radius-md'),
      border: `1px solid ${t['border-default']}`,
      borderHover: `1px solid ${t['accent-hover']}`,
      borderFocus: `1px solid ${t.accent}`,
      boxShadowFocus: `0 0 0 3px ${t['accent-soft']}`,
      caretColor: t.accent
    },

    Tag: {
      borderRadius: cssVar('--radius-pill')
    },

    Popover: {
      color: t['bg-elevated'],
      borderRadius: cssVar('--radius-lg')
    },

    Tabs: {
      tabBorderRadius: cssVar('--radius-md'),
      tabColorSegment: t['bg-sunken']
    },

    Divider: {
      color: t['border-subtle']
    },

    Skeleton: {
      color: t['bg-sunken'],
      colorEnd: t['accent-soft']
    }
  }
}

const currentTokens = computed(() => isDark.value ? dark : light)
export const currentCssVars = computed<Record<string, string>>(() => tokensToCssVars(currentTokens.value))
export const themeOverrides = computed<GlobalThemeOverrides>(() =>
  buildOverrides(currentTokens.value)
)
