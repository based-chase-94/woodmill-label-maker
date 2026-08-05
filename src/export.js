// Export the rendered label canvas to a print-true PDF and a high-res PNG.
// Both derive from the same canvas, so they are pixel-identical.
import { PDFDocument } from 'pdf-lib';

const PT_PER_IN = 72;
const LABEL_IN = 2.5;

export function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Build a 2.5" x 2.5" PDF with the label filling the page at true size.
// The canvas has a transparent background, so only the ring/art print — the
// white Avery stock shows through everywhere else.
export async function buildPdfBytes(canvas) {
  const blob = await canvasToPngBlob(canvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = await PDFDocument.create();
  const side = LABEL_IN * PT_PER_IN; // 180pt
  const page = pdf.addPage([side, side]);
  const png = await pdf.embedPng(bytes);
  page.drawImage(png, { x: 0, y: 0, width: side, height: side });
  pdf.setTitle('Woodmill Label');
  pdf.setProducer('Woodmill Label Maker');
  // Plain cross-reference table (no object streams) for maximum compatibility
  // with print/upload tools, and a self-verifiable MediaBox.
  return pdf.save({ useObjectStreams: false });
}

export function slugify(name) {
  return (name || 'label')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'label';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPdf(canvas, name) {
  const bytes = await buildPdfBytes(canvas);
  triggerDownload(new Blob([bytes], { type: 'application/pdf' }), `${slugify(name)}.pdf`);
}

export async function downloadPng(canvas, name) {
  const blob = await canvasToPngBlob(canvas);
  triggerDownload(blob, `${slugify(name)}.png`);
}
