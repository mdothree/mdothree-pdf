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
  const skipped = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(10 + (i / files.length) * 80);
    onProgress(pct, `Adding image ${i + 1}/${files.length}...`);

    const bytes = await file.arrayBuffer();
    const mime = file.type;

    let image;
    try {
      if ((mime === 'image/jpeg' || mime === 'image/jpg') && jpegOrientation(bytes) <= 1) {
        image = await pdfDoc.embedJpg(bytes);
      } else if (mime === 'image/jpeg' || mime === 'image/jpg') {
        // Phone photos store rotation in the EXIF Orientation tag; pdf-lib
        // embeds raw JPEG bytes and ignores it, so portrait shots came out
        // sideways. Decode with orientation applied and re-encode.
        image = await pdfDoc.embedJpg(await orientedJpegBytes(file));
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
      skipped.push(file.name);
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

  if (pdfDoc.getPageCount() === 0) {
    throw new Error('None of these images could be read. Use JPG, PNG, WebP or GIF files.');
  }

  onProgress(92, 'Saving PDF...');
  const pdfBytes = await pdfDoc.save();
  onProgress(100, 'Done!');

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  blob.pageCount = pdfDoc.getPageCount();
  blob.skipped = skipped;
  return blob;
}

/**
 * Read the EXIF Orientation tag (1-8) from JPEG bytes. Returns 1 when absent
 * or unreadable (1 = upright, no transform needed).
 */
export function jpegOrientation(buffer) {
  try {
    const v = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    if (v.getUint16(0) !== 0xFFD8) return 1;
    let off = 2;
    while (off + 4 <= v.byteLength) {
      const marker = v.getUint16(off);
      const size = v.getUint16(off + 2);
      if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
        const tiff = off + 10;
        const little = v.getUint16(tiff) === 0x4949;
        const ifd = tiff + v.getUint32(tiff + 4, little);
        const n = v.getUint16(ifd, little);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (v.getUint16(e, little) === 0x0112) return v.getUint16(e + 8, little) || 1;
        }
        return 1;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) return 1;
      off += 2 + size;
    }
  } catch (e) { /* fall through */ }
  return 1;
}

async function orientedJpegBytes(file) {
  let source;
  if (typeof createImageBitmap === 'function') {
    try { source = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { source = null; }
  }
  if (!source) {
    // <img> decoding applies EXIF orientation in all current browsers.
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image')); };
      img.src = url;
    });
  }
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(source, 0, 0);
  if (source.close) source.close();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Could not re-encode image');
  return new Uint8Array(await blob.arrayBuffer());
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
        if (!blob) return reject(new Error('Could not convert image'));
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
