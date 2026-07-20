<template>
  <NModal
    v-model:show="show"
    class="detail-modal"
    :mask-closable="true"
    :on-after-leave="afterLeave"
    :on-after-enter="onEnter"
  >
    <div v-if="props.iconData" class="detail">
      <!-- Header -->
      <header class="detail__head">
        <div class="detail__title">
          <div class="detail__name">{{ props.iconData.useId }}</div>
          <div class="detail__sub">
            <span class="badge" :class="`badge--${statusBadge.kind}`">
              {{ statusBadge.text }}
            </span>
            <span>{{ formatDate }}</span>
            <span class="dot">·</span>
            <span>{{ relativeDate }}</span>
          </div>
        </div>
        <button class="icon-btn" @click="closeModal" title="关闭 (Esc)" aria-label="关闭">
          <Icon icon="material-symbols:close-rounded" class="text-base" />
        </button>
      </header>

      <!-- Font-render issue banner -->
      <div
        v-if="props.iconData.format !== 'svg' && repairInfo?.needsRepair"
        class="repair-banner"
        :class="{ 'repair-banner--blocked': !repairInfo.supported }"
      >
        <Icon icon="material-symbols:warning-rounded" class="text-base shrink-0" />
        <span class="flex-1">
          <template v-if="repairInfo.reason === 'stroke'">
            描边图标在字体中无法渲染——可一键「描边转轮廓」修复并保存。
          </template>
          <template v-else>
            该图标在字体中会渲染异常(镂空被填实 / 缠绕方向)——可一键修复并保存。
          </template>
        </span>
        <button
          v-if="repairInfo.supported"
          class="repair-banner__btn"
          :disabled="repairing"
          @click="handleRepair"
        >
          {{ repairing ? '修复中…' : '一键修复并保存' }}
        </button>
      </div>

      <!-- Stage -->
      <section
        class="stage"
        ref="stageRef"
        :data-bg="bg"
        :data-cmp="cmp"
        :style="{ '--detail-size': detailSize + 'px' }"
      >
        <div class="stage__pane stage__pane--svg" ref="svgPaneRef" :style="paneStyle('svg')">
          <span class="stage__tag">SVG · {{ svgRenderSize?.join(' × ') ?? '—' }}</span>
          <span class="stage__pane-render-box" :class="{ hidden: !showRenderBoxAlignLine }">
            <img
              ref="svgImgRef"
              class="stage__media stage__media--svg"
              :class="{ inverted: bg === 'dark', }"
              :src="`${baseUrl}@fs/${props.iconData.absolutePath}`"
              alt=""
              :style="transformStyle"
            />
          </span>
        </div>
        <div class="stage__pane stage__pane--font" :style="paneStyle('font')">
          <span class="stage__pane-render-box" :class="{ hidden: !showRenderBoxAlignLine }">
            <i
              v-if="props.iconData.format !== 'svg'"
              ref="fontGlyphRef"
              class="stage__media stage__media--font"
              :class="props.iconData.useId"
              :style="{ fontSize: detailSize + 'px', ...(transformStyle as any) }"
            />
            <svg
              v-else
              ref="fontGlyphRef"
              class="stage__media stage__media--font"
              :width="detailSize"
              :height="detailSize"
              :viewBox="props.iconData.viewBox"
              :style="transformStyle as any"
              aria-hidden="true"
            >
              <use :href="`#${props.iconData.useId}`" />
            </svg>
          </span>
          <span class="stage__tag">
            {{ props.iconData.format === 'svg' ? 'Sprite' : 'Font' }} ·
            {{ fontRenderSize?.join(' × ') ?? '—' }}
          </span>
        </div>

        <!-- Split-mode handle -->
        <div
          v-if="cmp === 'split'"
          class="stage__divider"
          :style="{ left: split + '%' }"
          @pointerdown="onSplitGrab"
          ref="splitHandleRef"
          role="separator"
          aria-orientation="vertical"
          :aria-valuenow="Math.round(split)"
        >
          <div class="stage__grip">
            <Icon icon="material-symbols:drag-indicator" class="text-base" />
          </div>
        </div>
        <div
          v-if="cmp === 'overlay'"
          class="absolute w-full bottom-0 flex items-center gap-3 px-2 py-3"
        >
          <NSlider
            :theme-overrides="{ fontSize: '12px' }"
            :value="overlay"
            @update:value="(v) => (overlay = Array.isArray(v) ? v[0] : v)"
            :min="0"
            :max="100"
            :step="1"
            :format-tooltip="() => `透明度 ${overlay}%`"
            show-tooltip
          />
        </div>
      </section>

      <!-- Stage toolbar -->
      <div class="stage-toolbar">
        <div class="seg flex-3" role="tablist" aria-label="对比模式">
          <button
            v-for="opt in cmpOptions"
            :key="opt.value"
            :class="['seg__btn', cmp === opt.value && 'is-active']"
            @click="cmp = opt.value"
          >
            <Icon :icon="opt.icon" class="text-[15px] text-base" />
            {{ opt.label }}
          </button>
        </div>
        <div class="seg" role="tablist" aria-label="背景">
          <button
            v-for="opt in bgOptions"
            :key="opt.value"
            class="seg__btn seg__btn--icon"
            :class="bg === opt.value && 'is-active'"
            :title="opt.label"
            @click="bg = opt.value"
          >
            <span :class="['bg-swatch', `bg-swatch--${opt.value}`]" />
          </button>
        </div>
        <div class="seg flex-2" role="tablist" aria-label="预览尺寸">
          <button
            v-for="px in DETAIL_SIZES"
            :key="px"
            :class="['seg__btn seg__btn--num', detailSize === px && 'is-active']"
            @click="detailSize = px"
          >
            {{ px }}
          </button>
        </div>
        <div class="seg flex-3">
          <button
            class="seg__btn seg__btn--icon"
            title="隐藏对齐线"
            :class="showRenderBoxAlignLine && 'is-active'"
            @click="showRenderBoxAlignLine = !showRenderBoxAlignLine"
          >
            <Icon icon="material-symbols:grid-goldenratio-rounded" class="text-base" />
          </button>
          <button class="seg__btn seg__btn--icon" title="逆时针旋转 90°" @click="rot -= 90">
            <Icon icon="material-symbols:rotate-90-degrees-ccw-outline-rounded" class="text-base" />
          </button>
          <button class="seg__btn seg__btn--icon" title="顺时针旋转 90°" @click="rot += 90">
            <Icon icon="material-symbols:rotate-90-degrees-cw-outline-rounded" class="text-base" />
          </button>
          <button
            class="seg__btn seg__btn--icon"
            :class="flipH && 'is-active'"
            title="水平翻转"
            @click="flipH = !flipH"
          >
            <Icon icon="fluent:flip-horizontal-48-filled" class="text-base" />
          </button>
          <button
            class="seg__btn seg__btn--icon"
            :class="flipV && 'is-active'"
            title="垂直翻转"
            @click="flipV = !flipV"
          >
            <Icon icon="fluent:flip-vertical-48-filled" class="text-base" />
          </button>
          <button class="seg__btn seg__btn--icon" title="复位" @click="resetTransform">
            <Icon icon="material-symbols:refresh-rounded" class="text-base" />
          </button>
        </div>
      </div>

      <!-- Lower split: metadata + code -->
      <div class="detail__lower">
        <!-- Metadata -->
        <section class="h-full">
          <h3 class="section-title">元信息</h3>
          <div class="info">
            <dl class="info__grid">
              <div class="info__row">
                <dt>id</dt>
                <dd>
                  <code>{{ props.iconData.useId }}</code>
                  <ClipboardButton :text="props.iconData.useId" />
                </dd>
              </div>
              <div class="info__row" v-if="unicode">
                <dt>unicode</dt>
                <dd>
                  <code>U+{{ unicode }}</code>
                  <code class="muted">\{{ unicode.toLowerCase() }}</code>
                  <ClipboardButton :text="`\\${unicode.toLowerCase()}`" />
                </dd>
              </div>
              <div class="info__row">
                <dt>路径</dt>
                <dd>
                  <code class="truncate">{{ props.iconData.relativePath }}</code>
                  <ClipboardButton
                    v-if="props.iconData.relativePath"
                    :text="props.iconData.relativePath"
                  />
                </dd>
              </div>
              <div class="info__row">
                <dt>格式</dt>
                <dd>
                  <code>{{ props.iconData.format === 'svg' ? 'svg (sprite)' : 'font' }}</code>
                </dd>
              </div>
              <div class="info__row">
                <dt>viewBox</dt>
                <dd>
                  <code>{{ meta.viewBox || '-' }}</code>
                  <ClipboardButton v-if="meta.viewBox" :text="meta.viewBox" />
                </dd>
              </div>
              <div class="info__row">
                <dt>文件体积</dt>
                <dd>
                  <code>{{ meta.size }}</code>
                </dd>
              </div>
              <div class="info__row">
                <dt>hash</dt>
                <dd>
                  <code class="muted">{{ meta.hash || '-' }}</code>
                  <ClipboardButton v-if="meta.hash" :text="meta.hash" />
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- Code snippets -->
        <section class="code" v-if="props.iconData">
          <h3 class="section-title">使用代码</h3>
          <div class="code__tabs seg" role="tablist">
            <button
              v-for="t in codeTabs"
              :key="t.value"
              role="tab"
              class="seg__btn code__tab"
              :class="codeTab === t.value && 'is-active'"
              @click="codeTab = t.value"
              :aria-selected="codeTab === t.value"
            >
              {{ t.label }}
            </button>
          </div>
          <template v-if="codeTab === 'html'">
            <h3 class="section-title mt-2!">html</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto">
                <NCode class="lang-markup" language="xml" :code="htmlSnippet"></NCode>
                <ClipboardButton :text="htmlSnippet" class="absolute right-2 top-4.5" />
              </div>
            </div>
          </template>
          <template v-if="codeTab === 'react'">
            <h3 class="section-title mt-2!">React</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto">
                <NCode class="lang-markup" language="xml" :code="getJsxCode(props.iconData.id)" />
                <ClipboardButton
                  :text="getJsxCode(props.iconData.id)"
                  class="absolute right-2 top-4.5"
                />
              </div>
            </div>
          </template>
          <template v-if="codeTab === 'css'">
            <h3 class="section-title mt-2!">Css</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto">
                <NCode
                  class="lang-markup"
                  language="css"
                  :code="getCssCode(props.iconData.id)"
                ></NCode>
                <ClipboardButton
                  :text="getCssCode(props.iconData.id)"
                  class="absolute right-2 top-4.5"
                />
              </div>
            </div>
          </template>
          <template v-else-if="codeTab === 'svg'">
            <h3 class="section-title mt-2!">Svg</h3>
            <div class="code__body">
              <div class="code-content info overflow-auto max-h-40">
                <NCode class="lang-markup" language="xml" :code="svgCode" />
                <div class="info inline-block absolute right-2 top-2 p-2! leading-0">
                  <ClipboardButton :text="svgCode" />
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>
    </div>
    <div v-else></div>
  </NModal>
</template>

<script setup lang="ts">
import { NModal, NSlider, NCode, useMessage } from 'naive-ui'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import {
  _IconDataItem,
  formatRelativeDate,
  tryFixDecimal,
  baseUrl,
  readUnicodeFromClass,
  getHtmlCode,
  getJsxCode,
  getCssCode,
  getSvgUseCode,
  saveIconSvg
} from '../logic'
import { Icon } from '@iconify/vue'
import ClipboardButton from '../components/ClipboardButton.vue'
import { formatXml } from '../utils/formatXml'
import { useEventListener } from '@vueuse/core'
import { detectIconIssue, type IconRepairResult } from '../utils/svg/repair'
import { fnv1a } from '../utils/svg/hash'
import { getViewBox } from '../utils/svg/getViewBox'
import { formatBytes } from '../utils/formatBytes'

export interface Props {
  iconData: _IconDataItem | null
  show: boolean
}
const props = defineProps<Props>()
const emits = defineEmits(['closed', 'update:show'])

const show = computed({
  get: () => props.show,
  set: (v) => emits('update:show', v)
})

type Cmp = 'side' | 'overlay' | 'split'
type Bg = 'checker' | 'dark' | 'light'
type CodeLang = 'html' | 'svg' | 'react' | 'css'

const iconType = computed(() => {
  if (!props.iconData) return null
  return props.iconData?.format === 'svg' ? 'svg' : 'font'
})
const cmp = ref<Cmp>('side')
const bg = ref<Bg>('checker')
const DETAIL_SIZES = [48, 96, 160, 240] as const
const detailSize = ref<number>(96)
const overlay = ref(60) // Font opacity %
const split = ref(50) // % from left

const rot = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const showRenderBoxAlignLine = ref(true)

const cmpOptions = [
  { value: 'side' as const, label: '并排', icon: 'material-symbols:view-column-2-outline' },
  { value: 'overlay' as const, label: '叠加', icon: 'material-symbols:layers-rounded' },
  {
    value: 'split' as const,
    label: '分割',
    icon: 'material-symbols:split-scene-right-outline-rounded'
  }
]

const bgOptions = [
  { value: 'checker' as const, label: '棋盘格' },
  { value: 'dark' as const, label: '深底' },
  { value: 'light' as const, label: '浅底' }
]

const codeTabs = computed(() =>
  props.iconData?.format === 'svg'
    ? [
        { value: 'html' as const, label: 'HTML' },
        { value: 'svg' as const, label: 'SVG' }
      ]
    : [
        { value: 'html' as const, label: 'HTML' },
        { value: 'react' as const, label: 'React' },
        { value: 'css' as const, label: 'CSS' },
        { value: 'svg' as const, label: 'SVG' }
      ]
)
const codeTab = ref<CodeLang>('html')
// 切换图标时重置到 HTML,避免 svg 图标停留在已隐藏的 React/CSS tab
watch(
  () => props.iconData?.id,
  () => {
    codeTab.value = 'html'
  }
)

/* ─── Font-render check + one-click repair ─── */
const message = useMessage()
const repairInfo = ref<IconRepairResult | null>(null)
const repairing = ref(false)

watch(
  () => props.iconData?.svg,
  async (svg) => {
    repairInfo.value = null
    if (!svg || props.iconData?.format === 'svg') return
    const result = await detectIconIssue(svg)
    // guard against races when switching icons quickly
    if (props.iconData?.svg === svg) repairInfo.value = result
  },
  { immediate: true }
)

async function handleRepair() {
  const info = repairInfo.value
  if (!props.iconData || !info?.repaired) return
  repairing.value = true
  try {
    await saveIconSvg(props.iconData.absolutePath, info.repaired)
    message.success('已修复并保存,正在重建字体…')
    repairInfo.value = { needsRepair: false, supported: true, reason: 'ok' }
  } catch {
    message.error('保存失败,请重试')
  } finally {
    repairing.value = false
  }
}

const meta = computed(() => {
  const svg = props.iconData?.svg

  if (!svg) return { svg: 0, size: 0, hash: null, viewBox: '' }

  const viewBoxRaw = getViewBox(svg)
  const size = formatBytes(svg.length)
  const hash = fnv1a(svg)

  return { size, hash, viewBox: `${viewBoxRaw.x} ${viewBoxRaw.y} ${viewBoxRaw.w} ${viewBoxRaw.h}` }
})

// Header badge, kept in sync with the font-render check (no "像素一致" while the
// banner reports a problem).
const statusBadge = computed<{ text: string; kind: 'ok' | 'warn' | 'checking' }>(() => {
  if (props.iconData?.format === 'svg') return { text: 'SVG · 多色', kind: 'ok' }
  const info = repairInfo.value
  if (!info) return { text: '检测中…', kind: 'checking' }
  if (!info.needsRepair) return { text: '像素一致', kind: 'ok' }
  if (info.reason === 'stroke') return { text: '描边需轮廓化', kind: 'warn' }
  return { text: '渲染异常', kind: 'warn' }
})
const svgCode = computed(() => (props.iconData ? formatXml(props.iconData.svg) : ''))
const htmlSnippet = computed(() => {
  if (!props.iconData) return ''
  return props.iconData.format === 'svg'
    ? getSvgUseCode(props.iconData.useId)
    : getHtmlCode(props.iconData.id)
})
const lastModified = computed(() =>
  props.iconData ? new Date(props.iconData.lastModified) : new Date()
)
const formatDate = computed(() => lastModified.value.toLocaleString())
const relativeDate = computed(() => formatRelativeDate(lastModified.value) || '')

const unicode = ref<string | null>(null)

const transformStyle = computed(() => {
  const sx = flipH.value ? -1 : 1
  const sy = flipV.value ? -1 : 1
  return {
    transform: `rotate(${rot.value}deg) scale(${sx}, ${sy})`,
    transition: 'transform .2s var(--ease-out)'
  }
})

function resetTransform() {
  rot.value = 0
  flipH.value = false
  flipV.value = false
}

function paneStyle(which: 'svg' | 'font'): Record<string, string> {
  if (cmp.value === 'side') {
    return { width: '50%', clipPath: 'none' }
  }
  if (cmp.value === 'overlay') {
    if (which === 'svg') return { position: 'absolute', inset: '0', opacity: '1' }
    return { position: 'absolute', inset: '0', opacity: String(overlay.value / 100) }
  }
  const pct = split.value
  if (which === 'svg') {
    return {
      position: 'absolute',
      inset: '0',
      clipPath: `inset(0 ${100 - pct}% 0 0)`
    }
  }
  return {
    position: 'absolute',
    inset: '0',
    clipPath: `inset(0 0 0 ${pct}%)`
  }
}

const stageRef = useTemplateRef('stageRef')
const splitHandleRef = useTemplateRef('splitHandleRef')

function onSplitGrab(e: PointerEvent) {
  const stage = stageRef.value
  const splitHandle = splitHandleRef.value
  if (!stage || !splitHandle) return

  const onMove = (ev: PointerEvent) => {
    const rect = stage.getBoundingClientRect()
    const pct = ((ev.clientX - rect.left) / rect.width) * 100
    split.value = Math.max(2, Math.min(98, pct))
  }
  const onUp = (ev: PointerEvent) => {
    splitHandle.releasePointerCapture(ev.pointerId)
    stage.removeEventListener('pointermove', onMove)
    stage.removeEventListener('pointerup', onUp)
  }
  splitHandle.setPointerCapture(e.pointerId)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
}

const svgImgRef = ref<HTMLImageElement | null>(null)
const fontGlyphRef = ref<HTMLElement | SVGSVGElement | null>(null)
const svgRenderSize = ref<[number, number] | null>(null)
const fontRenderSize = ref<[number, number] | null>(null)

function measure() {
  if (svgImgRef.value) {
    const r = svgImgRef.value.getBoundingClientRect()
    svgRenderSize.value = [tryFixDecimal(r.width), tryFixDecimal(r.height)]
  }
  if (fontGlyphRef.value) {
    const r = fontGlyphRef.value.getBoundingClientRect()
    fontRenderSize.value = [tryFixDecimal(r.width), tryFixDecimal(r.height)]
  }
}

watch([() => detailSize.value, () => props.show, () => cmp.value], () => {
  if (show.value) requestAnimationFrame(measure)
})

/* ─── Escape to close + unicode probe on open ─── */
function onEnter() {
  requestAnimationFrame(measure)
  unicode.value = props.iconData ? readUnicodeFromClass(props.iconData.useId) : null
}

function afterLeave() {
  emits('closed')
  resetTransform()
}

function closeModal() {
  show.value = false
}

useEventListener('keydown', (e) => {
  if (!show.value) return
  if (e.key === 'Escape') closeModal()
})

watch(
  () => props.iconData?.useId,
  () => {
    resetTransform()
    nextTick(() => {
      unicode.value = props.iconData ? readUnicodeFromClass(props.iconData.useId) : null
      measure()
    })
  }
)
</script>

<style lang="scss" scoped>
.detail {
  width: min(880px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-lg);
}

/* ─── Header ─── */
.detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.detail__name {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}
.detail__sub {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
}
.detail__sub .dot {
  color: var(--text-muted);
}
.badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  letter-spacing: 0.03em;
  background: var(--accent-soft);
  color: var(--accent-active);
}
.badge--stroke,
.badge--warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.badge--checking {
  background: var(--bg-sunken);
  color: var(--text-muted);
}

/* ─── Repair banner ─── */
.repair-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 12.5px;
  background: var(--warn-soft);
  color: var(--warn);
  border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
}
.repair-banner--blocked {
  opacity: 0.92;
}
.repair-banner__btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-on-accent);
  background: var(--accent);
  border: 1px solid var(--accent);
  transition: 0.15s var(--ease-out);
}
.repair-banner__btn:hover:not(:disabled) {
  background: var(--accent-active);
}
.repair-banner__btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.15s var(--ease-out);
}
.icon-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

/* ─── Stage ─── */
.stage {
  position: relative;
  display: flex;
  min-height: 418px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  overflow: hidden;
  box-shadow: var(--inset);
}

.stage[data-bg='checker'] {
  background-color: #2a2a2a;
  background-image:
    linear-gradient(45deg, #3a3a3a 25%, transparent 25%),
    linear-gradient(-45deg, #3a3a3a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3a3a3a 75%),
    linear-gradient(-45deg, transparent 75%, #3a3a3a 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  color: #fff;
}

.stage[data-bg='dark'] {
  background: #111;
  color: #fff;
}
.stage[data-bg='light'] {
  background: #fafafa;
  color: #111;
}

.stage__pane {
  position: relative;
  place-items: center;
  overflow: hidden;
  aspect-ratio: 1 / 1;
  width: 100%;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: var(--slant-size-24);
}

[data-bg='dark'] .stage__pane {
  --bg-1: linear-gradient(90deg, transparent 19px, rgba(255, 255, 255, 0.08) 20px);
  --bg-2: linear-gradient(180deg, transparent 19px, rgba(255, 255, 255, 0.08) 20px);
  --bg-fade: radial-gradient(circle at 50% 50%, transparent 0%, transparent 20%, #111 80%);
  background-image: var(--bg-fade), var(--bg-1), var(--bg-2);
  background-size:
    100%,
    20px 100%,
    100% 20px;
  background-position: 50%;
}

[data-bg='light'] .stage__pane {
  --bg-1: linear-gradient(90deg, transparent 19px, rgba(0, 0, 0, 0.08) 20px);
  --bg-2: linear-gradient(180deg, transparent 19px, rgba(0, 0, 0, 0.08) 20px);
  --bg-fade: radial-gradient(circle at 50% 50%, transparent 0%, transparent 20%, #f9f9f9 80%);
  background-image: var(--bg-fade), var(--bg-1), var(--bg-2);
  background-size:
    100%,
    20px 100%,
    100% 20px;
  background-position: 50%;
}

.stage__pane-render-box {
  position: relative;
  display: inline-block;
  user-select: none;
  -webkit-user-drag: none;
  line-height: 0;

  &.hidden {
    &::before,
    &::after {
      display: none;
    }
  }

  &::before,
  &::after {
    content: '';
    transform: translateX(-50%) translateY(-50%);
    position: absolute;
    top: 50%;
    left: 50%;
    transition: border 0.3s;
    user-select: none;
    pointer-events: none;
  }
  $polyline: 1px dashed color-mix(in srgb, var(--text-secondary) 55%, transparent);

  &::before {
    width: 100vw;
    height: 100%;
    border-top: $polyline;
    border-bottom: $polyline;
  }
  &::after {
    height: 100vh;
    width: 100%;
    border-left: $polyline;
    border-right: $polyline;
  }
}
.stage:hover .stage__pane-render-box {
  &::before,
  &::after {
    border-color: color-mix(in srgb, var(--text-secondary) 85%, transparent);
  }
}

.stage__media {
  display: block;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}
.stage__media--svg {
  width: var(--detail-size);
  height: var(--detail-size);
}
.stage[data-bg='light'] .stage__media--svg {
  filter: none;
}
.stage[data-bg='dark'] .stage__media--svg.inverted,
.stage[data-bg='checker'] .stage__media--svg {
  filter: invert(1);
}

.stage__tag {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  letter-spacing: 0.02em;
  z-index: 3;
  pointer-events: none;
}
.stage[data-bg='light'] .stage__tag {
  background: rgba(255, 255, 255, 0.85);
  color: #1a1c1d;
}

.stage[data-cmp='side'] .stage__pane + .stage__pane {
  border-left: 1px dashed rgba(255, 255, 255, 0.15);
}
.stage[data-bg='light'][data-cmp='side'] .stage__pane + .stage__pane {
  border-left-color: rgba(0, 0, 0, 0.1);
}

.stage[data-cmp='overlay'] .stage__pane,
.stage[data-cmp='split'] .stage__pane {
  width: 100%;
  height: 100%;
}

/* split divider */
.stage__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 2px solid var(--accent);
  z-index: 4;
  cursor: ew-resize;
  touch-action: none;
}
.stage__grip {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--text-on-accent);
  box-shadow: var(--shadow-md);
}

/* ─── Stage toolbar ─── */
.stage-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.seg {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 4px;
  background: var(--bg-sunken);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}
.seg__btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 30px;
  height: 28px;
  padding: 0 8px;
  border: none;
  line-height: 100%;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.13s var(--ease-out);
  border: 1px solid transparent;

  &:hover {
    color: var(--text-primary);
  }

  &.is-active {
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  &--icon,
  &--num {
    padding: 5px;
    aspect-ratio: 1/1;
    min-width: 28px;
  }
  &--num {
    font-family: var(--font-mono);
    font-size: 12px;
  }
}

.bg-swatch {
  display: inline-block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.bg-swatch--checker {
  background-image:
    linear-gradient(45deg, #888 25%, transparent 25%),
    linear-gradient(-45deg, #888 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #888 75%),
    linear-gradient(-45deg, transparent 75%, #888 75%);
  background-size: 6px 6px;
  background-position:
    0 0,
    0 3px,
    3px -3px,
    -3px 0;
  background-color: #ddd;
}
.bg-swatch--dark {
  background: #111;
}
.bg-swatch--light {
  background: #fff;
}

.detail__lower {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 16px;
}
@media (max-width: 720px) {
  .detail__lower {
    grid-template-columns: 1fr;
  }
}

.section-title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.info {
  padding: 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
.info__grid {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 6px 12px;
  margin: 0;
}
.info__row {
  display: contents;
}
.info__row dt {
  color: var(--text-muted);
  font-size: 12px;
  align-self: center;
}
.info__row dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.info__row code {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-sunken);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
}
.info__row code.muted {
  color: var(--text-secondary);
}
.info__row code.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

/* ─── Code snippets ─── */
.code__tabs .code__tab.is-active {
  color: var(--accent) !important;
}

.code__body {
  position: relative;
  flex: 1;
}
</style>

<style>
/* Naive modal container override — let our own .detail set the padding/bg */
.detail-modal .n-card {
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
}
.detail-modal .n-card > .n-card__content {
  padding: 0 !important;
}

.n-modal-mask {
  background: color-mix(in srgb, rgb(5, 5, 10) 65%, transparent);
  backdrop-filter: blur(6px);
}
</style>
