// imagesToPdf.js — Convert images to PDF using pdf-lib

const PAGE_SIZES = {
  a4:     [595.28, 841.89],   // points
  letter: [612, 792],
};

export async function imagesToPDF(files, options = {}, onProgress = () => {}) {
  const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
  const { pageSize = 'a4' } = options;

  onProgress(5, 'Creating PDF...');
  const pdfDoc = await PDFDocument.create();
  const [pageW, pageH] = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;
  const fitToImage = pageSize === 'fit';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(10 + (i / files.length) * 80);
    onProgress(pct, `Adding image ${i + 1}/${files.length}...`);

    const bytes = await file.arrayBuffer();
    const mime = file.type;

    let image;
    try {
      if (mime === 'image/jpeg' || mime === 'image/jpg') {
        image = await pdfDoc.embedJpg(bytes);
      } else if (mime === 'image/png') {
        image = await pdfDoc.embedPng(bytes);
      } else {
        // Convert to PNG via canvas for WebP/GIF etc.
        const dataUrl = await fileToDataUrl(file);
        const pngBytes = await dataUrlToPngBytes(dataUrl);
        image = await pdfDoc.embedPng(pngBytes);
      }
    } catch (e) {
      console.warn(`Skipping "${file.name}":`, e.message);
      continue;
    }

    const imgDims = image.scale(1);
    let width, height;

    if (fitToImage) {
      width = imgDims.width;
      height = imgDims.height;
    } else {
      // Scale image to fit page with margins
      const margin = 20;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = Math.min(maxW / imgDims.width, maxH / imgDims.height);
      width = imgDims.width * ratio;
      height = imgDims.height * ratio;
    }

    const page = pdfDoc.addPage(fitToImage ? [width, height] : [pageW, pageH]);
    const x = (page.getWidth() - width) / 2;
    const y = (page.getHeight() - height) / 2;

    page.drawImage(image, { x, y, width, height });
  }

  onProgress(92, 'Saving PDF...');
  const pdfBytes = await pdfDoc.save();
  onProgress(100, 'Done!');

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function dataUrlToPngBytes(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
