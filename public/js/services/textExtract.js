// textExtract.js — Extract text from PDF using PDF.js

const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js/+esm';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export async function extractText(file, options = {}, onProgress = () => {}) {
  // The jsDelivr +esm build of pdfjs 3.x only exposes GlobalWorkerOptions on
  // the default export (the CJS exports object), not as a named export.
  const pdfjsMod = await import(PDFJS_CDN);
  const pdfjsLib = pdfjsMod.default ?? pdfjsMod;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  onProgress(10, 'Loading PDF...');
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPages = pdf.numPages;

  let pageIndices;
  if (options.pageRange?.trim()) {
    pageIndices = parsePageRange(options.pageRange, totalPages);
  } else {
    pageIndices = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  let fullText = '';

  for (let idx = 0; idx < pageIndices.length; idx++) {
    const pageNum = pageIndices[idx];
    const pct = Math.round(15 + (idx / pageIndices.length) * 80);
    onProgress(pct, `Extracting page ${pageNum}/${totalPages}...`);

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Keep the PDF's line breaks (hasEOL) instead of flattening each page
    // into a single paragraph.
    const pageText = textContent.items
      .map(item => (item.str || '') + (item.hasEOL ? '\n' : ' '))
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/ {2,}/g, ' ')
      .trim();

    fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
  }

  onProgress(100, 'Done!');
  return fullText.trim();
}

function parsePageRange(rangeStr, totalPages) {
  const pages = new Set();
  rangeStr.split(',').forEach(part => {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(Number);
      for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) pages.add(i);
    } else {
      const n = parseInt(trimmed);
      if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
    }
  });
  return Array.from(pages).sort((a, b) => a - b);
}
