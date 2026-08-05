// Canvas label renderer for the 2.5" round Avery 5294 label.
//
// One high-resolution square canvas is the single source of truth: the PNG export
// is this canvas, and the PDF embeds this canvas. Everything is drawn in device
// pixels at `cfg.size` (600 DPI by default), then displayed scaled-down on screen.
//
// Layout is measure-then-distribute: we measure each block's height, then space
// the stack vertically with equal gaps (space-around). Removing the ingredients
// block naturally drops the logo lower and lifts the barcode — matching the client's
// two reference designs. All content is kept inside the circular safe area.

// All sizes are fractions of the canvas side S, so the design scales with DPI.
export const DEFAULT_CFG = {
  dpi: 600,
  size: 1500,            // 2.5in * 600dpi
  safeInsetIn: 0.125,    // Avery-recommended safe margin from the die-cut edge

  ring: true,
  ringWidthPt: 0.9,      // thin inset keyline
  ringInsetIn: 0.125,    // ring sits at the safe radius (inside the cut)

  bandFactor: 0.93,      // vertical span used for content, as a fraction of safe radius
  minGapF: 0.018,        // minimum gap between blocks, as a fraction of S
  contentChordMargin: 0.95, // keep content this fraction inside the chord width

  item: { maxF: 0.125, minF: 0.052, widthF: 0.90, maxLines: 3, lineHeight: 0.96, tracking: 0.04, family: 'Koulen', weight: '400' },
  ing:  { maxF: 0.045, minF: 0.026, widthF: 0.86, maxLines: 2, lineHeight: 1.16, tracking: 0.00, family: 'Mohave', weight: '500', marginTopF: 0.035 },

  logo:    { widthF: 0.33 },
  barcode: { widthF: 0.50 },
};

const supportsLetterSpacing = (() => {
  try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); }
  catch { return false; }
})();

function setFont(ctx, px, o) {
  ctx.font = `${o.weight} ${px}px ${o.family}, sans-serif`;
  if (supportsLetterSpacing) ctx.letterSpacing = `${o.tracking * px}px`;
}

function lineWidth(ctx, str, px, o) {
  setFont(ctx, px, o);
  let w = ctx.measureText(str).width;
  // If the browser can't apply canvas letterSpacing, add tracking manually.
  if (!supportsLetterSpacing && o.tracking) w += o.tracking * px * Math.max(0, str.length - 1);
  return w;
}

function flow(ctx, words, px, o, maxWidth) {
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (!cur || lineWidth(ctx, test, px, o) <= maxWidth) cur = test;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Balanced wrap: use the fewest lines that fit maxWidth (via greedy), then find
// the *narrowest* width that still yields that many lines. This evens out the
// lines so a title breaks like "CHOPPED / FARMER SALAD" rather than the greedy
// "CHOPPED FARMER / SALAD".
function wrap(ctx, words, px, o, maxWidth) {
  const base = flow(ctx, words, px, o, maxWidth);
  if (base.length <= 1) return base;
  let lo = 0;
  for (const w of words) lo = Math.max(lo, lineWidth(ctx, w, px, o)); // widest single word
  let hi = maxWidth, best = base;
  for (let i = 0; i < 20 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    const t = flow(ctx, words, px, o, mid);
    if (t.length <= base.length) { best = t; hi = mid; } else { lo = mid; }
  }
  return best;
}

// Choose the largest font size (down to a floor) that fits the text into maxLines
// lines within maxWidth, then return the laid-out block.
//
// - Explicit line breaks the user typed (\n) are always honored: each becomes a
//   forced line, and the auto-wrap only runs within each segment.
// - sizeScale (default 1) is the manual title-size override: after the automatic
//   fit is chosen, the size is scaled up/down and re-wrapped. The circle-safety
//   pass in renderLabel still clamps it, so it can never overflow the label.
function layoutText(ctx, text, o, S, maxWidthPx, sizeScale = 1) {
  const segments = text.toUpperCase().split('\n')
    .map((s) => s.trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length);
  if (!segments.length) {
    return { type: 'text', text, lines: [], fontPx: o.minF * S, lineHeight: 0, w: 0, h: 0, o };
  }
  const effMaxLines = Math.max(o.maxLines, segments.length); // never fight forced breaks
  const wrapAll = (px) => segments.flatMap((words) => wrap(ctx, words, px, o, maxWidthPx));

  const maxPx = o.maxF * S, minPx = o.minF * S;
  const step = Math.max(1, maxPx * 0.02);
  let px = maxPx, lines = wrapAll(px);
  while (px > minPx) {
    lines = wrapAll(px);
    const widest = Math.max(0, ...lines.map((l) => lineWidth(ctx, l, px, o)));
    if (lines.length <= effMaxLines && widest <= maxWidthPx) break;
    px -= step;
  }
  px = Math.max(px, minPx);
  if (sizeScale !== 1) px = Math.max(8, px * sizeScale); // manual override
  lines = wrapAll(px);

  const lh = px * o.lineHeight;
  const w = Math.max(0, ...lines.map((l) => lineWidth(ctx, l, px, o)));
  return { type: 'text', text, lines, fontPx: px, lineHeight: lh, w, h: lh * lines.length, o };
}

function drawText(ctx, b, cx) {
  setFont(ctx, b.fontPx, b.o);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Canvas centers including the trailing letter-spacing; nudge back by half a step.
  const nudge = supportsLetterSpacing ? (b.o.tracking * b.fontPx) / 2 : 0;
  let y = b.y;
  for (const line of b.lines) {
    ctx.fillText(line, cx - nudge, y);
    y += b.lineHeight;
  }
}

// Half-width of the circle's horizontal chord at vertical distance `dy` from center.
function halfChord(radius, dy) {
  const inside = radius * radius - dy * dy;
  return inside > 0 ? Math.sqrt(inside) : 0;
}

export function renderLabel(canvas, model, cfg = DEFAULT_CFG) {
  const S = cfg.size;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const c = S / 2;
  const R = S / 2;
  const Rsafe = R - cfg.safeInsetIn * cfg.dpi;

  // Inset keyline ring.
  if (cfg.ring) {
    const rRing = R - cfg.ringInsetIn * cfg.dpi;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = cfg.ringWidthPt * (cfg.dpi / 72);
    ctx.beginPath();
    ctx.arc(c, c, rRing, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Build blocks top-to-bottom. Text uses the wide chord near the middle for its
  // initial max width; a refine pass below re-clamps to the true chord once placed.
  const blocks = [];
  const title = layoutText(ctx, model.itemName || '', cfg.item, S, cfg.item.widthF * S, model.titleScale ?? 1);
  title.marginTop = (model.titleMarginF || 0) * S; // user-controlled space above the title
  blocks.push(title);

  const logoAspect = model.logo.height / model.logo.width;
  const logoW = cfg.logo.widthF * S;
  blocks.push({ type: 'logo', w: logoW, h: logoW * logoAspect, img: model.logo.img });

  const hasIng = model.ingredients && model.ingredients.trim();
  if (hasIng) {
    const ing = layoutText(ctx, model.ingredients, cfg.ing, S, cfg.ing.widthF * S);
    ing.marginTop = (cfg.ing.marginTopF || 0) * S; // extra breathing room below the logo
    blocks.push(ing);
  }

  const bc = model.barcodeCanvas;
  const bcW = cfg.barcode.widthF * S;
  blocks.push({ type: 'barcode', w: bcW, h: bcW * (bc.height / bc.width), img: bc });

  // --- vertical distribution ------------------------------------------------
  const band = Rsafe * cfg.bandFactor;   // half-height of the content band
  const bandH = 2 * band;
  const minGap = cfg.minGapF * S;

  const scaleBlock = (b, s) => {
    if (s >= 1) return;
    const oldH = b.h;
    if (b.type === 'text') { b.fontPx *= s; b.lineHeight *= s; }
    b.w *= s; b.h *= s;
    b.y += (oldH - b.h) / 2; // keep centered on its slot
  };

  // Fixed per-block top margins (extra room above the title / ingredients) are
  // reserved out of the band before the flexible gaps are computed.
  const fixedMargins = blocks.reduce((a, b) => a + (b.marginTop || 0), 0);
  const maxContentH = bandH - (blocks.length + 1) * minGap - fixedMargins;

  const shrink = (b, s) => { if (b.type === 'text') { b.fontPx *= s; b.lineHeight *= s; } b.w *= s; b.h *= s; };
  const sumH = () => blocks.reduce((a, b) => a + b.h, 0);

  // 1) Fit to the band. The title keeps its (possibly slider-scaled) size — only the
  //    secondary blocks shrink to make room — so the Title-size control actually
  //    changes the title, not just the spacing. If the title is so large the others
  //    would collapse, everything scales down together as a safety net.
  if (sumH() > maxContentH) {
    const others = blocks.slice(1);
    const othersH = others.reduce((a, b) => a + b.h, 0);
    const availForOthers = maxContentH - title.h;
    if (availForOthers >= maxContentH * 0.4 && othersH > availForOthers) {
      const s = availForOthers / othersH;
      for (const b of others) shrink(b, s);
    } else {
      const s = maxContentH / sumH();
      for (const b of blocks) shrink(b, s);
    }
  }
  let totalH = sumH();

  // 2) Space-around: equal gaps above, below, and between blocks. Dropping the
  //    ingredients block widens the gaps — lowering the logo and lifting the
  //    barcode — which reproduces the client's two reference designs.
  const gap = (bandH - totalH - fixedMargins) / (blocks.length + 1);
  let y = c - band + gap;
  for (const b of blocks) { y += (b.marginTop || 0); b.y = y; y += b.h + gap; }

  // 3) Safety: keep each block inside the circular chord at its widest extent,
  //    scaling the offending block down in place (never re-wrapping text).
  for (const b of blocks) {
    const dy = Math.max(Math.abs(b.y - c), Math.abs(b.y + b.h - c));
    const allowed = 2 * halfChord(Rsafe, dy) * cfg.contentChordMargin;
    if (allowed > 0 && b.w > allowed) scaleBlock(b, allowed / b.w);
  }

  // Draw.
  for (const b of blocks) {
    if (b.type === 'text') drawText(ctx, b, c);
    else ctx.drawImage(b.img, c - b.w / 2, b.y, b.w, b.h);
  }
  return canvas;
}
