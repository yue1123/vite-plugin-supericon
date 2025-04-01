<template>
  <div class="toolbar h-16 flex justify-center items-center bg-zinc-800 dark:bg-zinc-900">
    <div class="toolbar-contents space-x-4 flex justify-start items-center">
      <div class="relative w-full max-w-sm items-center">
        <input
          ref="inputRef"
          v-model="searchText"
          data-slot="input"
          type="text"
          placeholder="Search..."
          :class="[
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input',
            'flex h-9 w-full min-w-0 rounded-md border bg-transparent px-10 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ]"
        />
        <span class="absolute start-0 inset-y-0 flex items-center justify-center px-2">
          <Icon icon="mynaui:search" class="size-6 text-muted-foreground" />
        </span>
        <span
          class="absolute end-0 inset-y-0 flex items-center justify-center px-2 text-xs text-muted-foreground"
        >
          ⌘K
        </span>
      </div>
      <div class="h-9 px-2 flex space-x-2 justify-around items-center bg-stone-50 rounded-md">
        <div class="w-8 text-pretty text-sm">{{ sliderValue[0] }}px</div>
        <SliderRoot
        v-model="sliderValue"
        class="relative flex items-center select-none touch-none w-[150px] h-2"
        :max="100"
        :step="1"
      >
        <SliderTrack class="bg-stone-500/30 relative grow rounded-full h-1">
          <SliderRange class="absolute bg-grass8 rounded-full h-full" />
        </SliderTrack>
        <SliderThumb
          class="block w-4 h-4 bg-white rounded-full hover:bg-stone-50 shadow-sm focus:outline-none focus:shadow-[0_0_0_2px] focus:shadow-grass9"
          aria-label="Volume"
        />
      </SliderRoot>
      </div>
    </div>
  </div>
  <div class="pt-2 p-4"></div>
</template>

<script setup lang="ts">
  import { searchText } from '@/logic/search'
  import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
  import { Icon } from '@iconify/vue'
  import { useMagicKeys } from '@vueuse/core'
  import { ref, useTemplateRef, watch } from 'vue'
  const inputRef = useTemplateRef<HTMLInputElement>('inputRef')
  const { Ctrl_K, Command_K } = useMagicKeys()
  const sliderValue = ref([50])

  watch(
    () => Ctrl_K.value || Command_K.value,
    (n) => {
      n && inputRef.value?.focus()
    }
  )
</script>
