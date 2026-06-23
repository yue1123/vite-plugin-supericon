// Test icons for the SVG -> iconfont repair lab.
// `bad` icons rely on fill-rule="evenodd" / multiple shapes to punch holes,
// which break when rasterized by a font (non-zero winding rule).
window.ICONS = [
  {
    name: 'flask (example 1)',
    note: 'separate dots path (nonzero) + evenodd flask body with nested holes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <g fill="currentColor">
    <path d="M11.939 9.765a1 1 0 1 1-1.813-.845a1 1 0 0 1 1.813.845M8.92 13.874a1 1 0 1 0 .845-1.813a1 1 0 0 0-.846 1.813m4.955 1.206a1 1 0 1 1-1.813-.845a1 1 0 0 1 1.813.846m.361-3.142a1 1 0 1 0 .845-1.813a1 1 0 0 0-.845 1.813"/>
    <path fill-rule="evenodd" d="M17.071 1.124a6 6 0 0 0-7.973 2.902L4.026 14.902a6 6 0 0 0 10.876 5.072l5.072-10.876a6 6 0 0 0-2.903-7.974m-3.136 16.192l3.38-7.25l-7.25-3.382l-3.38 7.25zm-.846 1.812l-7.25-3.38a4 4 0 1 0 7.25 3.38m3.137-16.191a4 4 0 0 1 1.935 5.316l-7.25-3.381a4 4 0 0 1 5.315-1.935" clip-rule="evenodd"/>
  </g>
</svg>`
  },
  {
    name: 'window (example 2)',
    note: 'single path, evenodd, frame with inner panes as holes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" fill-rule="evenodd" d="M2 19a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3zm18 0a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5v8.011h2.395L14 9.864l1.605 2.147H18V4h1a1 1 0 0 1 1 1zM16 4h-4v5.336l2-2.676l2 2.676z" clip-rule="evenodd"/>
</svg>`
  },
  {
    name: 'donut (control)',
    note: 'even-odd hole, but authored with OPPOSITE sweep flags -> already font-safe',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20m0 4a6 6 0 1 1 0 12a6 6 0 0 1 0-12"/>
</svg>`
  },
  {
    name: 'donut-hard (same winding)',
    note: 'pure even-odd: outer+inner circle wound the SAME way -> font fills the hole solid',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20m0 4a6 6 0 1 0 0 12a6 6 0 0 0 0-12"/>
</svg>`
  },
  {
    name: 'two-holes',
    note: 'rect frame with two square holes, all subpaths same winding (even-odd)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" fill-rule="evenodd" d="M2 2h20v20H2zM5 5h6v14H5zM13 5h6v14h-6z"/>
</svg>`
  },
  {
    name: 'overlap (two separate disks)',
    note: 'two same-colour disks in SEPARATE paths that PARTIALLY overlap. Truth=union (lens filled).',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" d="M9 4a5 5 0 1 0 0 10a5 5 0 0 0 0-10"/>
  <path fill="currentColor" d="M15 10a5 5 0 1 0 0 10a5 5 0 0 0 0-10"/>
</svg>`
  },
  {
    name: 'nested-fill (blob inside blob)',
    note: 'DECISIVE: small filled disk FULLY INSIDE a big filled disk, separate same-colour paths. Truth=solid big disk. reorient (containment) wrongly punches a hole; normalize+concat keeps it solid.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20"/>
  <path fill="currentColor" d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8"/>
</svg>`
  }
];
