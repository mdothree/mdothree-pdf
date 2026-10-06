/**
 * pdfCompress.js — Real PDF compression via page rasterisation + JPEG re-encoding
 *
 * Approach:
 *   1. Load the PDF with PDF.js (rasterise each page to a canvas)
 *   2. Re-encode each page as JPEG at the requested quality
 *   3. Rebuild the PDF using pdf-lib with the compressed JPEG pages
 *
 * This produces genuine file size reduction for image-heavy PDFs.
 * For text-only PDFs the savings are minimal (try metadata removal only).
 *
 * Scale: 1.0 = 72 DPI (small), 1.5 = 108 DPI (balanced), 2.0 = 144 DPI (sharp)
 */

const PDFJS_CDN    = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js/+esm';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export async function compressPDF(file, options = {}, onProgress = () => {}) {
  const { quality = 0.72, scale = 1.5, removeMetadata = true } = options;

  onProgress(5, 'Loading libraries…');
  const [pdfjsMod, { PDFDocument }] = await Promise.all([
    import(PDFJS_CDN),
    import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'),
  ]);
  // The jsDelivr +esm build of pdfjs 3.x only exposes GlobalWorkerOptions on
  // the default export (the CJS exports object), not as a named export.
  const pdfjsLib = pdfjsMod.default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  onProgress(12, 'Loading PDF…');
  const bytes = await file.arrayBuffer();
  const srcPdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPages = srcPdf.numPages;

  const newDoc = await PDFDocument.create();

  for (let p = 1; p <= totalPages; p++) {
    const pct = Math.round(12 + ((p - 1) / totalPages) * 75);
    onProgress(pct, `Compressing page ${p}/${totalPages}…`);

    // Rasterise page at chosen scale
    const page = await srcPdf.getPage(p);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Encode as JPEG at requested quality
    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
    const jpegBytes   = _dataUrlToBytes(jpegDataUrl);

    // Embed into new PDF
    const jpegImg    = await newDoc.embedJpg(jpegBytes);
    const { width: iw, height: ih } = jpegImg.scale(1);
    const newPage    = newDoc.addPage([iw, ih]);
    newPage.drawImage(jpegImg, { x: 0, y: 0, width: iw, height: ih });
  }

  onProgress(90, 'Saving…');

  if (removeMetadata) {
    newDoc.setTitle(''); newDoc.setAuthor(''); newDoc.setSubject('');
    newDoc.setKeywords([]); newDoc.setProducer('mdothree.com'); newDoc.setCreator('mdothree.com');
  }

  const outBytes = await newDoc.save({ useObjectStreams: true });
  onProgress(100, 'Done!');

  return new Blob([outBytes], { type: 'application/pdf' });
}

function _dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
