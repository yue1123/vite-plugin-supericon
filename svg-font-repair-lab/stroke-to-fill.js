/**
 * stroke-to-fill — convert a STROKE-based SVG icon into a FILL-based one, by
 * the same "rasterize then trace" method as oslllo-svg-fixer (resvg + potrace),
 * but browser-only and dependency-free:
 *
 *   1. Render the real SVG to a high-res canvas (default 600px) on a WHITE
 *      background. The browser's own engine draws the stroke — so every
 *      stroke-width / linecap / linejoin / miterlimit / dasharray / transform /
 *      inherited (cascaded) attribute / nested group "just works". We never
 *      parse the SVG ourselves.
 *   2. Hand the white-background raster (as a PNG) to potrace, which traces the
 *      black pixels into vector FILL contours (holes wound opposite -> safe
 *      under BOTH even-odd and non-zero, i.e. font-safe).
 *   3. Scale the traced path back to the original viewBox units and wrap it in a
 *      clean single-<path> SVG with `fill`, no `stroke`.
 *
 * WHY rasterize+trace instead of geometric stroke offsetting: it reuses the
 * browser's pixel-exact stroker, so the result matches the source down to the
 * antialiasing noise floor for ANY stroked icon, with no offset/boolean math.
 * Cost: the trace re-fits curves (not literally identical geometry), but at
 * 600px the error is sub-noise-floor — verified in stroke-fix.html.
 *
 * Depends on the global `Potrace` (vendor/potrace.js, a pure-JS port — GPL).
 * Browser only: needs `document`, `<canvas>` and `Image`.
 */
(function () {
  'use strict';

  function getViewBox(svg) {
    const m = svg.match(/viewBox\s*=\s*"([\d.+\-eE\s,]+)"/);
    if (m) {
      const [x, y, w, h] = m[1].trim().split(/[\s,]+/).map(Number);
      if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) return { x, y, w, h };
    }
    return { x: 0, y: 0, w: 24, h: 24 };
  }

  // Render `svg` to a white-background canvas of `w`x`h` px and return it.
  // currentColor -> #000 so a default stroke="currentColor" draws as black ink.
  function rasterizeToWhiteCanvas(svg, w, h) {
    return new Promise((resolve, reject) => {
      let s = svg.replace(/currentColor/g, '#000');
      // Force the outer <svg> to render at our target pixel size (keep viewBox).
      s = s.replace(/<svg\b[^>]*>/, (tag) =>
        tag
          .replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
          .replace('<svg', `<svg width="${w}" height="${h}"`)
      );
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h); // potrace treats transparent as black -> need white
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(cv);
      };
      img.onerror = (e) => reject(new Error('svg raster failed: ' + e));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }

  function runPotrace(pngUrl, params) {
    return new Promise((resolve) => {
      if (params) Potrace.setParameter(params);
      Potrace.loadImageFromUrl(pngUrl);
      Potrace.process(resolve);
    });
  }

  const DEFAULTS = {
    resolution: 600, // raster width in px before tracing (svg-fixer's default)
    turnpolicy: 'minority',
    turdsize: 2, // drop speckles <= this area (in raster px) — noise only at 600px
    optcurve: true,
    alphamax: 1, // corner threshold; lower keeps sharp corners sharper
    opttolerance: 0.2,
  };

  /**
   * strokeToFill(svgString, opts?) -> Promise<{ svg, d, viewBox }>
   *   svg: clean single-<path> fill SVG (fill="currentColor", no stroke)
   *   d:   the traced path data, in original viewBox units
   */
  async function strokeToFill(svgString, opts) {
    if (typeof Potrace === 'undefined') throw new Error('vendor/potrace.js not loaded');
    const o = Object.assign({}, DEFAULTS, opts || {});
    const vb = getViewBox(svgString);

    const rw = Math.max(1, Math.round(o.resolution));
    const rh = Math.max(1, Math.round(o.resolution * (vb.h / vb.w)));

    const canvas = await rasterizeToWhiteCanvas(svgString, rw, rh);
    const pngUrl = canvas.toDataURL('image/png');

    await runPotrace(pngUrl, {
      turnpolicy: o.turnpolicy,
      turdsize: o.turdsize,
      optcurve: o.optcurve,
      alphamax: o.alphamax,
      opttolerance: o.opttolerance,
    });

    // getSVG(size) multiplies traced pixel coords by `size`; map raster px -> vb units.
    const scale = vb.w / rw;
    const tracedSvg = Potrace.getSVG(scale);
    const m = tracedSvg.match(/<path[^>]*\sd="([^"]*)"/);
    const d = m ? m[1].trim() : '';

    // potrace coords are 0-based (raster origin) -> emit a 0-based viewBox.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb.w} ${vb.h}">` +
      `<path fill="currentColor" d="${d}"/></svg>`;

    return { svg, d, viewBox: { x: 0, y: 0, w: vb.w, h: vb.h } };
  }

  if (typeof window !== 'undefined') {
    window.strokeToFill = strokeToFill;
    window.strokeToFillGetViewBox = getViewBox;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { strokeToFill };
})();
