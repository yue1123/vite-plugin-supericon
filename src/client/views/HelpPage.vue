<template>
  <div class="help-page" :style="{ filter: 'none' }">
    <!-- Sketch-rough filter — every hand-drawn SVG references this. -->
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <defs>
        <filter id="sk-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="6" />
          <feDisplacementMap in="SourceGraphic" scale="2.6" />
        </filter>
      </defs>
    </svg>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__kicker">✎ supericon · 使用手册</div>
      <h1 class="hero__title">
        把一堆 SVG,<br />
        <span class="hero__wave">收编成</span>
        一套图标字体
      </h1>
      <p class="hero__lead">
        把图标 SVG 丢进目录,插件会在 dev / build 时自动生成 iconfont、字符映射与类型提示。
      </p>
    </section>

    <!-- ① Three steps -->
    <section class="block">
      <div class="block__heading">
        <span class="block__num">①</span>
        <h2 class="block__title">三步接入</h2>
      </div>

      <div class="steps">
        <article v-for="(step, i) in steps" :key="i" class="step">
          <div class="step__sketch">
            <svg viewBox="0 0 120 120" class="step__svg" aria-hidden="true">
              <g filter="url(#sk-rough)" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <template v-if="i === 0">
                  <!-- Folder/file drop -->
                  <path d="M22 38 H58 L66 30 H98 V94 H22 Z" />
                  <path d="M40 56 H80" />
                  <path d="M40 66 H72" />
                  <path d="M40 76 H66" />
                  <path d="M60 14 v18 M52 24 l8 8 8 -8" stroke-width="1.6" />
                </template>
                <template v-else-if="i === 1">
                  <!-- Config gear -->
                  <circle cx="60" cy="60" r="22" />
                  <circle cx="60" cy="60" r="8" />
                  <path d="M60 30 v-8 M60 98 v-8 M30 60 h-8 M98 60 h-8 M40 40 l-6 -6 M86 40 l6 -6 M40 80 l-6 6 M86 80 l6 6" />
                </template>
                <template v-else>
                  <!-- Play -->
                  <circle cx="60" cy="60" r="36" />
                  <path d="M52 44 L80 60 L52 76 Z" fill="currentColor" stroke-linejoin="round" />
                </template>
              </g>
            </svg>
          </div>
          <div class="step__body">
            <div class="step__no">Step {{ i + 1 }}</div>
            <h3 class="step__title">{{ step.title }}</h3>
            <p class="step__desc">{{ step.desc }}</p>
            <pre class="step__code" v-html="step.code" />
          </div>
        </article>
      </div>
    </section>

    <!-- ② 6 drawing rules -->
    <section class="block">
      <div class="block__heading">
        <span class="block__num">②</span>
        <h2 class="block__title">画图标的 6 条规则</h2>
        <p class="block__sub">字体是单色、纯轮廓的载体。遵守这几条,SVG 才能干净地转成字形。</p>
      </div>

      <div class="rules">
        <article v-for="(rule, i) in rules" :key="rule.no" class="rule">
          <header class="rule__head">
            <span class="rule__no">{{ rule.no }}</span>
            <h3 class="rule__title">{{ rule.title }}</h3>
          </header>
          <p class="rule__point">{{ rule.point }}</p>

          <div class="rule__compare">
            <div class="cmp cmp--good">
              <span class="cmp__chip">✓ 推荐</span>
              <div class="cmp__art" v-html="rule.good" />
              <div class="cmp__label">{{ rule.goodLabel }}</div>
            </div>
            <div class="cmp cmp--bad">
              <span class="cmp__chip">✗ 避免</span>
              <div class="cmp__art" v-html="rule.bad" />
              <div class="cmp__label">{{ rule.badLabel }}</div>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const steps = [
  {
    title: '放入 SVG',
    desc: '把图标文件放进指定目录,子文件夹会成为分组。',
    code: `<span class="t-c">src/assets/icons/</span><span class="t-a">*.svg</span>`
  },
  {
    title: '配置插件',
    desc: '在 vite.config 注册,指定目录与字体名。',
    code:
      `<span class="t-k">import</span> si <span class="t-k">from</span> <span class="t-s">'vite-plugin-supericon'</span>\n` +
      `<span class="t-c">plugins</span>: [ si({ dir: <span class="t-s">'src/assets/icons'</span> }) ]`
  },
  {
    title: '启动与使用',
    desc: '运行 dev 即在预览页查看,按下方式引用。',
    code: `<span class="t-t">&lt;i</span> <span class="t-a">class</span>=<span class="t-s">"si si-home"</span><span class="t-t">&gt;&lt;/i&gt;</span>`
  }
]

const stroke = `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`
const fill = `fill="currentColor"`
const warn = `fill="none" stroke="var(--warn)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`
const filt = `filter="url(#sk-rough)"`

const rules = [
  {
    no: '01',
    title: '统一画布与网格',
    point: '所有图标在同一张 24×24 画布上绘制,对齐像素网格,用 keyline 圆/方做参考框统一视觉重量。',
    goodLabel: '整数坐标、偶数描边',
    badLabel: '0.5px 半像素错位',
    good: `<svg viewBox="0 0 64 64" ${filt}>
      <g stroke="currentColor" stroke-width="0.6" opacity="0.35" fill="none">
        <path d="M0 16H64M0 32H64M0 48H64M16 0V64M32 0V64M48 0V64" />
      </g>
      <rect x="16" y="16" width="32" height="32" rx="3" ${stroke}/>
    </svg>`,
    bad: `<svg viewBox="0 0 64 64" ${filt}>
      <g stroke="currentColor" stroke-width="0.6" opacity="0.35" fill="none">
        <path d="M0 16H64M0 32H64M0 48H64M16 0V64M32 0V64M48 0V64" />
      </g>
      <rect x="14.5" y="17.5" width="33" height="31" rx="2" ${warn}/>
    </svg>`
  },
  {
    no: '02',
    title: '留出安全边距',
    point: '四周留约 2px 安全区,主体落在 20×20 活动区内。',
    goodLabel: '主体居中、四周留白',
    badLabel: '图形顶满画布',
    good: `<svg viewBox="0 0 64 64" ${filt}>
      <rect x="6" y="6" width="52" height="52" rx="3" stroke="currentColor" stroke-width="0.6" stroke-dasharray="2 2" fill="none" opacity="0.4"/>
      <circle cx="32" cy="32" r="14" ${stroke}/>
    </svg>`,
    bad: `<svg viewBox="0 0 64 64" ${filt}>
      <rect x="6" y="6" width="52" height="52" rx="3" stroke="currentColor" stroke-width="0.6" stroke-dasharray="2 2" fill="none" opacity="0.4"/>
      <circle cx="32" cy="32" r="26" ${warn}/>
    </svg>`
  },
  {
    no: '03',
    title: '用填充而非描边',
    point: 'iconfont 字形只认填充轮廓,描边须先「描边转轮廓」。',
    goodLabel: 'fill + 闭合路径',
    badLabel: '开放的 stroke 线条',
    good: `<svg viewBox="0 0 64 64" ${filt}>
      <path d="M32 12 L52 30 L46 30 L46 52 L36 52 L36 38 L28 38 L28 52 L18 52 L18 30 L12 30 Z" ${fill}/>
    </svg>`,
    bad: `<svg viewBox="0 0 64 64" ${filt}>
      <path d="M14 32 L32 14 L50 32" ${warn}/>
      <path d="M20 30 V52 H44 V30" ${warn}/>
      <path d="M28 52 V40 H36 V52" ${warn}/>
    </svg>`
  },
  {
    no: '04',
    title: '合并为单一路径',
    point: '同图标所有形状做布尔并集,合成一条闭合路径,去重叠/镂空错误。',
    goodLabel: '并集 / 合并路径',
    badLabel: '多块重叠形状',
    good: `<svg viewBox="0 0 64 64" ${filt}>
      <path d="M16 24 a16 16 0 1 1 32 0 a16 16 0 0 1 -8 13 v9 h-16 v-9 a16 16 0 0 1 -8 -13 Z" ${fill}/>
    </svg>`,
    bad: `<svg viewBox="0 0 64 64" ${filt}>
      <circle cx="26" cy="26" r="14" fill="var(--warn)" opacity="0.45"/>
      <circle cx="38" cy="32" r="14" fill="var(--warn)" opacity="0.45"/>
      <rect x="22" y="38" width="20" height="10" fill="var(--warn)" opacity="0.45"/>
    </svg>`
  },
  {
    no: '05',
    title: '单色,清理多余属性',
    point: '移除 fill 颜色、内联 style、id、class,只留路径几何,颜色交给使用处 CSS。',
    goodLabel: '纯路径 + currentColor',
    badLabel: '多色 / 渐变 / 内联样式',
    good: `<svg viewBox="0 0 64 64" ${filt}>
      <path d="M14 32 L26 44 L50 18" ${stroke} stroke-width="3"/>
    </svg>`,
    bad: `<svg viewBox="0 0 64 64" ${filt}>
      <defs>
        <linearGradient id="hg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f87171"/>
          <stop offset="1" stop-color="#fbbf24"/>
        </linearGradient>
      </defs>
      <path d="M14 32 L26 44 L50 18" fill="none" stroke="url(#hg-grad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    no: '06',
    title: 'kebab-case 命名',
    point: '文件名直接决定图标 id,全小写中划线,语义在前修饰在后。',
    goodLabel: 'chevron-down',
    badLabel: 'ChevronDown / 带空格 / 副本后缀',
    good: `<svg viewBox="0 0 80 32" ${filt}>
      <text x="6" y="22" font-family="var(--font-mono)" font-size="14" fill="currentColor">chevron-down</text>
    </svg>`,
    bad: `<svg viewBox="0 0 80 32" ${filt}>
      <text x="6" y="22" font-family="var(--font-mono)" font-size="14" fill="var(--warn)">ChevronDown copy</text>
    </svg>`
  }
]
</script>

<style scoped>
.help-page {
  padding: 12px 0 80px;
  color: var(--text-primary);
}

/* ─── Hero ─── */
.hero {
  margin: 26px 0 36px;
  text-align: left;
}
.hero__kicker {
  font-family: var(--font-sketch);
  font-size: 22px;
  color: var(--text-secondary);
  letter-spacing: 0.01em;
  margin-bottom: 6px;
}
.hero__title {
  font-family: var(--font-sketch);
  font-weight: 700;
  font-size: clamp(40px, 6.4vw, 68px);
  line-height: 1.05;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  margin: 0;
}
.hero__wave {
  position: relative;
  display: inline-block;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero__wave::after {
  content: '';
  position: absolute;
  left: -2%;
  right: -2%;
  bottom: -10px;
  height: 12px;
  background:
    radial-gradient(circle at 6px 6px, var(--accent) 1.5px, transparent 2px) 0 0/12px 12px repeat-x,
    linear-gradient(transparent, transparent);
  mask: radial-gradient(circle at 6px 6px, #000 1.5px, transparent 2px) 0 0/12px 12px repeat-x;
  opacity: 0.7;
  filter: url(#sk-rough);
}
.hero__lead {
  margin-top: 26px;
  max-width: 64ch;
  font-family: var(--font-sketch-note);
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.55;
}

/* ─── Section block ─── */
.block {
  margin-top: 56px;
}
.block__heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}
.block__num {
  font-family: var(--font-sketch);
  font-size: 38px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.block__title {
  font-family: var(--font-sketch);
  font-size: 30px;
  font-weight: 700;
  margin: 0;
}
.block__sub {
  flex-basis: 100%;
  font-family: var(--font-sketch-note);
  font-size: 16px;
  color: var(--text-secondary);
  margin: 4px 0 0;
}

/* ─── Steps ─── */
.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}
.step {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border-radius: var(--radius-lg);
  border: 1px dashed color-mix(in srgb, var(--accent) 35%, var(--border-default));
  background: var(--bg-surface);
  box-shadow: var(--shadow-sm);
  transition: transform 0.16s var(--ease-out), box-shadow 0.18s var(--ease-out);
}
.step:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}
.step__sketch {
  width: 110px;
  height: 110px;
  color: var(--accent);
  align-self: center;
}
.step__svg {
  width: 100%;
  height: 100%;
}
.step__no {
  font-family: var(--font-sketch);
  font-size: 18px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.step__title {
  font-family: var(--font-sketch);
  font-size: 24px;
  font-weight: 700;
  margin: 2px 0 0;
}
.step__desc {
  font-family: var(--font-sketch-note);
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 6px 0 0;
}
.step__code {
  margin: 8px 0 0;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-sunken);
  border: 1px solid var(--border-default);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-secondary);
  white-space: pre;
  overflow-x: auto;
}
.step__code :deep(.t-k) { color: var(--accent); }
.step__code :deep(.t-s) { color: #b97acc; }
.step__code :deep(.t-c) { color: var(--text-primary); }
.step__code :deep(.t-a) { color: #d09657; }
.step__code :deep(.t-t) { color: #6da0e5; }

/* ─── Rules ─── */
.rules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}
.rule {
  padding: 22px;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-sm);
  transition: transform 0.16s var(--ease-out), box-shadow 0.18s var(--ease-out);
}
.rule:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.rule__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
}
.rule__no {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  letter-spacing: 0.03em;
}
.rule__title {
  font-family: var(--font-sketch);
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}
.rule__point {
  font-family: var(--font-sketch-note);
  font-size: 14.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 6px 0 14px;
}
.rule__compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cmp {
  position: relative;
  padding: 14px 12px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
  border: 1px dashed var(--border-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.cmp--good {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border-default));
  color: var(--accent);
}
.cmp--bad {
  border-color: color-mix(in srgb, var(--warn) 38%, var(--border-default));
  color: var(--warn);
}
.cmp__chip {
  font-family: var(--font-sketch);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.cmp__art {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
}
.cmp__art :deep(svg) {
  width: 100%;
  height: 100%;
}
.cmp__label {
  font-family: var(--font-sketch-note);
  font-size: 12.5px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.35;
}
</style>
