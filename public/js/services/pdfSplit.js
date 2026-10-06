// pdfSplit.js — Split PDF pages using pdf-lib

export async function splitPDF(file, mode, options = {}, onProgress = () => {}) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');

  onProgress(10, 'Loading PDF...');
  const bytes = await file.arrayBuffer();
  const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = srcPdf.getPageCount();

  if (mode === 'range') {
    onProgress(30, 'Parsing page range...');
    const indices = parsePageRange(options.pageRange, totalPages);
    if (!indices.length) throw new Error('No valid pages specified.');
    onProgress(50, `Extracting ${indices.length} pages...`);
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(srcPdf, indices.map(n => n - 1));
    pages.forEach(p => newPdf.addPage(p));
    onProgress(90, 'Saving...');
    const pdfBytes = await newPdf.save();
    downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'extracted.pdf');
    onProgress(100, 'Done!');

  } else if (mode === 'each') {
    // dist/jszip.min.js is a UMD build with no ES default export, so importing
    // it gave JSZip === undefined and the ZIP was never built. The +esm build
    // exports the constructor as default.
    const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').catch(() => ({ default: null }));
    const results = [];
    for (let i = 0; i < totalPages; i++) {
      const pct = Math.round(20 + (i / totalPages) * 70);
      onProgress(pct, `Extracting page ${i + 1}/${totalPages}...`);
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(srcPdf, [i]);
      newPdf.addPage(page);
      const pdfBytes = await newPdf.save();
      results.push({ name: `page-${i + 1}.pdf`, bytes: pdfBytes });
    }
    onProgress(92, 'Bundling ZIP...');
    if (JSZip) {
      const zip = new JSZip();
      results.forEach(r => zip.file(r.name, r.bytes));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'pages.zip');
    } else {
      // Fallback: download individually
      for (const r of results) {
        downloadBlob(new Blob([r.bytes], { type: 'application/pdf' }), r.name);
        await new Promise(res => setTimeout(res, 300));
      }
    }
    onProgress(100, 'Done!');

  } else if (mode === 'split') {
    const splitAt = options.splitAt;
    if (!splitAt || splitAt < 1 || splitAt >= totalPages) {
      throw new Error(`Split page must be between 1 and ${totalPages - 1}.`);
    }
    onProgress(30, 'Creating part 1...');
    const part1 = await PDFDocument.create();
    const pages1 = await part1.copyPages(srcPdf, Array.from({ length: splitAt }, (_, i) => i));
    pages1.forEach(p => part1.addPage(p));
    const bytes1 = await part1.save();
    downloadBlob(new Blob([bytes1], { type: 'application/pdf' }), 'part-1.pdf');

    onProgress(70, 'Creating part 2...');
    const part2 = await PDFDocument.create();
    const pages2 = await part2.copyPages(srcPdf, Array.from({ length: totalPages - splitAt }, (_, i) => i + splitAt));
    pages2.forEach(p => part2.addPage(p));
    const bytes2 = await part2.save();
    downloadBlob(new Blob([bytes2], { type: 'application/pdf' }), 'part-2.pdf');
    onProgress(100, 'Done!');
  }
}

function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr?.trim()) return Array.from({ length: totalPages }, (_, i) => i + 1);
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  // Revoking synchronously can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
