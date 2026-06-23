<template>
  <button title="Copy" v-bind="$attrs" v-if="isSupported" @click="handleCopy">
    <slot v-if="copied" name="copied">
      <Icon icon="gg:check" class="text-base" />
    </slot>
    <slot v-else>
      <Icon icon="material-symbols:content-copy-outline-rounded" class="text-base" />
    </slot>
  </button>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useClipboard } from '@vueuse/core'
import { useHasListener } from '../hooks/useHasListener'
import { useMessage } from 'naive-ui'

export interface Props {
  text: string
}
const props = defineProps<Props>()

const emits = defineEmits<{
  success: []
}>()
const hasSuccessCallback = useHasListener<typeof emits>('success')
const message = useMessage()
const { copy, copied, isSupported } = useClipboard({ source: props.text })
function handleCopy() {
  copy(props.text).then(() => {
    hasSuccessCallback.value ? emits('success') : message.success('Copied!')
  })
}
</script>
