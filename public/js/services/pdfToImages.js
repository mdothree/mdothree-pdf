// pdfToImages.js — Convert PDF pages to images using PDF.js

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js/+esm';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export async function pdfToImages(file, options = {}, onProgress = () => {}) {
  const { format = 'jpeg', quality = 0.9, scale = 2 } = options;

  onProgress(5, 'Loading PDF.js...');
  // The jsDelivr +esm build of pdfjs 3.x only exposes GlobalWorkerOptions on
  // the default export (the CJS exports object), not as a named export.
  const pdfjsMod = await import(PDFJS_CDN);
  const pdfjsLib = pdfjsMod.default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  onProgress(15, 'Loading PDF...');
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPages = pdf.numPages;
  const images = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pct = Math.round(15 + (pageNum / totalPages) * 80);
    onProgress(pct, `Rendering page ${pageNum}/${totalPages}...`);

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL(`image/${format}`, quality);
    images.push(dataUrl);
  }

  onProgress(100, 'Done!');
  return images;
}
