// pdfMerge.js — Merge multiple PDFs using pdf-lib (CDN)
// Uses: https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm

export async function mergePDFs(files, onProgress = () => {}) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');

  onProgress(5, 'Loading pdf-lib...');
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(10 + (i / files.length) * 80);
    onProgress(pct, `Processing ${file.name} (${i + 1}/${files.length})...`);

    const bytes = await file.arrayBuffer();
    let srcPdf;
    try {
      srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch (e) {
      // HID-002: an honest message, not the parser's internals (line/col/offset).
      const encrypted = /encrypt|password/i.test(e && e.message || '');
      throw new Error(encrypted
        ? `Could not read "${file.name}" — it is password-protected. Remove the password and try again.`
        : `Could not read "${file.name}" — the PDF looks damaged or incomplete. Try re-saving or re-exporting it, then merge again.`);
    }

    const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }

  onProgress(92, 'Saving merged PDF...');
  const pdfBytes = await mergedPdf.save();
  onProgress(100, 'Done!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}
