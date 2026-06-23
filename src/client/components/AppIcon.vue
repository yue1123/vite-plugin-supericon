<template>
  <Icon :icon="resolved" v-bind="$attrs" />
</template>

<script setup lang="ts">
/**
 * AppIcon — the single icon entrypoint for the app shell.
 *
 * Pass a Material Symbols icon name (without prefix or variant suffix), e.g. `search`.
 * `variant` picks between the two Material Symbols styles we standardize on:
 *   - rounded         → filled rounded   (material-symbols:NAME-rounded)
 *   - outline         → outlined rounded (material-symbols:NAME-outline-rounded)
 *
 * For the rare brand icon (GitHub, etc.) that Material Symbols doesn't ship,
 * pass `raw` instead of `name` to forward a fully-qualified Iconify id.
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

type Variant = 'rounded' | 'outline'

const props = withDefaults(
  defineProps<{
    name?: string
    raw?: string
    variant?: Variant
  }>(),
  { variant: 'rounded' }
)

const resolved = computed(() => {
  if (props.raw) return props.raw
  const suffix = props.variant === 'outline' ? 'outline-rounded' : 'rounded'
  return `material-symbols:${props.name}-${suffix}`
})
</script>
