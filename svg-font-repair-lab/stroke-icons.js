// Stroke-based test icons for the stroke->fill (rasterize+trace) lab.
// Each stresses a different part of the SVG stroke spec. Because the fixer
// rasterizes the REAL browser-rendered SVG, all of these "just work" — the list
// exists to PROVE that across caps / joins / curves / mixed fill+stroke.
window.STROKE_ICONS = [
  {
    name: 'square-x (user)',
    note: 'the original test: rounded rect (closed) + two lines (open), round cap + round join, inherited from <svg>',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <line x1="9" y1="9" x2="15" y2="15"/>
  <line x1="15" y1="9" x2="9" y2="15"/>
</svg>`
  },
  {
    name: 'check (round/round)',
    note: 'open polyline, round cap + round join — the most common Lucide/Feather shape',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>`
  },
  {
    name: 'caps butt/round/square',
    note: 'three thick lines with PER-ELEMENT linecap — tests all three cap kinds at once',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
  <line x1="6" y1="5" x2="6" y2="19" stroke-linecap="butt"/>
  <line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/>
  <line x1="18" y1="5" x2="18" y2="19" stroke-linecap="square"/>
</svg>`
  },
  {
    name: 'corner miter',
    note: 'L-shaped open polyline, sharp MITER join, butt caps',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="butt" stroke-linejoin="miter">
  <polyline points="5 4 5 20 20 20"/>
</svg>`
  },
  {
    name: 'corner bevel',
    note: 'same L polyline but BEVEL join — flattened outer corner',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="butt" stroke-linejoin="bevel">
  <polyline points="5 4 5 20 20 20"/>
</svg>`
  },
  {
    name: 'star (closed miter)',
    note: 'closed polygon with sharp points — miter joins all the way around a closed path',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter">
  <polygon points="12,2 14.2,8.6 21.4,8.6 15.6,13 17.8,19.8 12,15.6 6.2,19.8 8.4,13 2.6,8.6 9.8,8.6"/>
</svg>`
  },
  {
    name: 'circle ring',
    note: 'stroked <circle> = a ring; the hole in the middle must survive (closed curve + hole)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="9"/>
</svg>`
  },
  {
    name: 'wave (bezier)',
    note: 'cubic + smooth bezier path, round cap — tests offsetting of curved strokes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M2 16 C 6 6 10 6 12 12 S 18 18 22 8"/>
</svg>`
  },
  {
    name: 'target (fill+stroke)',
    note: 'stroked ring (hole) PLUS a filled centre dot inside the hole — mixed fill & stroke',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="12" cy="12" r="3" fill="currentColor"/>
</svg>`
  },
  {
    name: 'thick plus (overlap)',
    note: 'two thick round-cap lines that overlap at the centre — overlapping strokes must merge solid',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
  <line x1="12" y1="4" x2="12" y2="20"/>
  <line x1="4" y1="12" x2="20" y2="12"/>
</svg>`
  },
  {
    name: 'rotated rect (transform)',
    note: 'transform="rotate(...)" ON the element — outline must be rotated with it',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
  <rect x="6" y="6" width="12" height="12" rx="2" transform="rotate(20 12 12)"/>
</svg>`
  },
  {
    name: 'group translate+scale',
    note: 'circle inside <g transform="translate scale"> (uniform) — CTM applied to outline',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <g transform="translate(3 3) scale(0.75)"><circle cx="12" cy="12" r="10"/></g>
</svg>`
  },
  {
    name: 'non-uniform scale (ellipse)',
    note: 'HARD: circle under scale(1, 0.55) -> elliptical ring. Stroke must be stroked-then-transformed, not constant-width-offset',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <g transform="matrix(1 0 0 0.55 0 5.4)"><circle cx="12" cy="12" r="9"/></g>
</svg>`
  },
  {
    name: 'nested group + cascade',
    note: 'stroke props on OUTER group, transform on INNER group — a rotated plus, inherited through nesting',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
    <g transform="rotate(45 12 12)">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <line x1="12" y1="5" x2="12" y2="19"/>
    </g>
  </g>
</svg>`
  },
  {
    name: 'skew (shear)',
    note: 'HARD: skewX shear on a rounded rect — outline must shear with it (no constant-width offset can do this)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
  <g transform="skewX(-15) translate(4 0)"><rect x="5" y="5" width="12" height="14" rx="2"/></g>
</svg>`
  },
  {
    name: 'curved path + transform',
    note: 'bezier path stroked AND rotated — exercises curve flattening composed with the CTM',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M3 12 C 8 2, 16 22, 21 12" transform="rotate(30 12 12)"/>
</svg>`
  },
  {
    name: 'non-zero viewBox origin',
    note: 'REGRESSION GUARD: viewBox="10 10 24 24" — output must not be shifted off-canvas (paper bakes a translate)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="10 10 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="13" y="13" width="18" height="18" rx="2"/>
  <polyline points="19 19 22 25 28 16"/>
</svg>`
  },
  {
    name: "single-quoted rect + transform",
    note: "REGRESSION GUARD: single-quoted attrs (rx='2') under a transform — rect-to-path parse must keep rx",
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round'>
  <rect x='6' y='6' width='12' height='12' rx='2' transform='rotate(20 12 12)'/>
</svg>`
  }
];
