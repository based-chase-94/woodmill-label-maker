import './style.css';
import logoUrl from './assets/woodmill-logo.svg?url';
import { loadFonts } from './fonts.js';
import { analyzeProductNumber, renderBarcodeCanvas } from './barcode.js';
import { renderLabel, DEFAULT_CFG } from './label.js';
import { downloadPdf, downloadPng } from './export.js';

const els = {
  itemName: document.getElementById('itemName'),
  ingredients: document.getElementById('ingredients'),
  productNumber: document.getElementById('productNumber'),
  preview: document.getElementById('preview'),
  badge: document.getElementById('symBadge'),
  note: document.getElementById('symNote'),
  pdfBtn: document.getElementById('downloadPdf'),
  pngBtn: document.getElementById('downloadPng'),
  status: document.getElementById('status'),
  titleScale: document.getElementById('titleScale'),
  titleScaleVal: document.getElementById('titleScaleVal'),
  titleTop: document.getElementById('titleTop'),
  titleTopVal: document.getElementById('titleTopVal'),
  titleReset: document.getElementById('titleReset'),
};

let logo = null;            // { img, width, height }
let ready = false;
let lastAnalysis = null;

async function loadLogo() {
  const img = new Image();
  img.src = logoUrl;
  await img.decode();
  return { img, width: img.naturalWidth || 194, height: img.naturalHeight || 106 };
}

function setBadge(analysis) {
  if (!analysis || !analysis.ok) {
    els.badge.textContent = 'No barcode';
    els.badge.className = 'badge badge-empty';
    els.note.textContent = analysis && analysis.reason === 'empty'
      ? 'Enter a product number to generate the barcode.' : '';
    return;
  }
  els.badge.textContent = `Detected: ${analysis.symbology}`;
  els.badge.className = `badge ${analysis.fallback ? 'badge-fallback' : 'badge-ok'}`;
  els.note.textContent = analysis.note || '';
}

// Debounced live render.
let raf = 0;
function scheduleRender() {
  if (!ready) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
}

function render() {
  const itemName = els.itemName.value.trim();
  const ingredients = els.ingredients.value.trim();
  const analysis = analyzeProductNumber(els.productNumber.value);
  lastAnalysis = analysis;
  setBadge(analysis);

  const pct = Number(els.titleScale.value);
  els.titleScaleVal.textContent = pct === 100 ? 'Auto' : `${pct}%`;
  const topPct = Number(els.titleTop.value);
  els.titleTopVal.textContent = topPct === 0 ? 'None' : String(topPct);

  const canDraw = analysis.ok;
  els.pdfBtn.disabled = !canDraw;
  els.pngBtn.disabled = !canDraw;
  if (!canDraw) {
    els.preview.getContext('2d').clearRect(0, 0, els.preview.width, els.preview.height);
    return;
  }

  const barcodeCanvas = renderBarcodeCanvas(analysis);
  renderLabel(
    els.preview,
    { itemName, ingredients, logo, barcodeCanvas, titleScale: pct / 100, titleMarginF: topPct / 100 },
    DEFAULT_CFG,
  );
}

function currentName() {
  return els.itemName.value.trim() || 'woodmill-label';
}

async function withStatus(msg, fn) {
  els.status.textContent = msg;
  try { await fn(); els.status.textContent = ''; }
  catch (err) { console.error(err); els.status.textContent = `Error: ${err.message}`; }
}

els.pdfBtn.addEventListener('click', () =>
  withStatus('Building PDF…', () => downloadPdf(els.preview, currentName())));
els.pngBtn.addEventListener('click', () =>
  withStatus('Building PNG…', () => downloadPng(els.preview, currentName())));

for (const id of ['itemName', 'ingredients', 'productNumber']) {
  els[id].addEventListener('input', scheduleRender);
}
els.titleScale.addEventListener('input', scheduleRender);
els.titleTop.addEventListener('input', scheduleRender);
els.titleReset.addEventListener('click', () => {
  els.titleScale.value = '100';
  els.titleTop.value = '0';
  scheduleRender();
});

// --- boot -------------------------------------------------------------------
(async function boot() {
  await loadFonts();
  logo = await loadLogo();
  ready = true;
  render();
  runSelfTest();
})();

// Barcode symbology self-test against the client's known numbers. Logs to the
// console so we can confirm detection without a test runner.
function runSelfTest() {
  const cases = [
    ['35039952', 'EAN-8'],
    ['0717550106686', 'EAN-13'],
    ['91847025', 'Code 128'],
    ['38151613', 'EAN-8'],
  ];
  const rows = cases.map(([num, expect]) => {
    const got = analyzeProductNumber(num).symbology;
    return { number: num, expected: expect, got, pass: got === expect ? '✅' : '❌' };
  });
  // eslint-disable-next-line no-console
  console.table(rows);
  window.__selfTest = rows;
}
