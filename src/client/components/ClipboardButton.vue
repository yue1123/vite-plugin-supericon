<template>
  <Button title="Copy" v-bind="$attrs" v-if="isSupported" @click="handleCopy">
    <slot v-if="copied" name="copied">
      <Icon icon="gg:check" />
    </slot>

    <slot v-else></slot>
  </Button>
</template>

<script setup lang="ts">
  import Button from './Button.vue'
  import { useClipboard } from '@vueuse/core'
  import { useMessage } from 'naive-ui'
  import { Icon } from '@iconify/vue'

  export interface Props {
    /** copy content */
    text: string
  }

  const props = defineProps<Props>()
  const { copy, copied, isSupported } = useClipboard({ source: props.text })
  const message = useMessage()
  function handleCopy() {
    message.success('Copied')
    copy(props.text)
  }
</script>
