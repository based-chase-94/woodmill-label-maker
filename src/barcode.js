// Barcode symbology selection + rendering.
//
// RULE (agreed with client): the product number is the FULL number including its
// check digit. We pick the symbology by validating that check digit, NOT by length
// alone — because their real products mix EAN-8, EAN-13, and internal Code128 codes,
// and two different products can both be 8 digits. The register matches on the
// decoded digit string, which is identical in every branch below, so whatever is
// already in their POS keeps scanning.
//
//   8 digits  + valid EAN-8  check -> EAN-8
//   12 digits + valid UPC-A  check -> UPC-A
//   13 digits + valid EAN-13 check -> EAN-13
//   anything else                  -> Code 128  (e.g. 91847025, a valid internal code)
import bwipjs from 'bwip-js';

// --- check-digit validators -------------------------------------------------
// EAN/UPC use a mod-10 weighted checksum. The only difference between them is
// which positions get weight 3 vs weight 1.
function mod10Check(digits, weightForOddPosition) {
  // weightForOddPosition applies to positions 1,3,5,... (0-indexed 0,2,4,...)
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const odd = i % 2 === 0;
    sum += Number(digits[i]) * (odd ? weightForOddPosition : (weightForOddPosition === 3 ? 1 : 3));
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}

export const isValidEan8  = (d) => /^\d{8}$/.test(d)  && mod10Check(d, 3); // odd positions weight 3
export const isValidUpcA  = (d) => /^\d{12}$/.test(d) && mod10Check(d, 3); // odd positions weight 3
export const isValidEan13 = (d) => /^\d{13}$/.test(d) && mod10Check(d, 1); // odd positions weight 1

// --- symbology decision -----------------------------------------------------
export function analyzeProductNumber(raw) {
  const value = String(raw ?? '').replace(/\s+/g, '');
  if (!value) {
    return { ok: false, reason: 'empty', value };
  }
  const numeric = /^\d+$/.test(value);

  if (numeric && value.length === 8 && isValidEan8(value)) {
    return ok('ean8', 'EAN-8', value);
  }
  if (numeric && value.length === 12 && isValidUpcA(value)) {
    return ok('upca', 'UPC-A', value);
  }
  if (numeric && value.length === 13 && isValidEan13(value)) {
    return ok('ean13', 'EAN-13', value);
  }

  // Fallback: internal / non-standard code. Explain WHY, so a mistyped retail
  // code (which would silently fall through to Code128) is noticeable.
  let note = 'Encoded as Code 128 (internal code).';
  if (numeric && [8, 12, 13].includes(value.length)) {
    const kind = value.length === 8 ? 'EAN-8' : value.length === 13 ? 'EAN-13' : 'UPC-A';
    note = `${value.length} digits, but not a valid ${kind} check digit — encoded as Code 128 (matches internal-code labels). Double-check the number if this was meant to be a retail code.`;
  } else if (!numeric) {
    note = 'Contains non-digits — encoded as Code 128.';
  }
  return { ok: true, bcid: 'code128', symbology: 'Code 128', value, fallback: true, note };
}

function ok(bcid, symbology, value) {
  return { ok: true, bcid, symbology, value, fallback: false, note: `Valid ${symbology}.` };
}

// --- rendering --------------------------------------------------------------
// Renders the barcode to its own high-res offscreen canvas. The label renderer
// composites it. bwip-js draws the standard human-readable text itself, which for
// EAN means the correct guard-split placement (e.g. "3503 9952").
export function renderBarcodeCanvas(analysis, opts = {}) {
  const canvas = document.createElement('canvas');
  const isEan = analysis.bcid !== 'code128';
  // Render large; the label composites it downscaled, which keeps bar edges hard
  // (better for scanning) than upscaling a small barcode would.
  const scale = opts.scale ?? (isEan ? 9 : 6);
  const bwipOpts = {
    bcid: analysis.bcid,
    text: analysis.value,
    scale,
    height: isEan ? 9 : 7,     // bar height (mm-ish); kept short so it scans but doesn't dominate
    includetext: true,
    textxalign: 'center',
    textsize: isEan ? 11 : 10,
    paddingwidth: 8,   // quiet zone on each side (scannability), no guard indicators
    paddingheight: 2,
  };
  bwipjs.toCanvas(canvas, bwipOpts);
  return canvas;
}
