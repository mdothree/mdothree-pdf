// fileHandlers.js — Shared utilities for file handling

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function isPdfFile(file) {
  return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

// HID-002: a real PDF starts with "%PDF-" (the spec allows up to 1024 leading bytes before it).
// Pure check on bytes so it can be unit-tested without a browser.
export function hasPdfHeader(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const n = Math.min(u8.length, 1024) - 5;
  for (let i = 0; i <= n; i++) {
    if (u8[i] === 0x25 && u8[i + 1] === 0x50 && u8[i + 2] === 0x44 && u8[i + 3] === 0x46 && u8[i + 4] === 0x2d) return true;
  }
  return false;
}

// Reads the first 1 KB of a File/Blob and checks the PDF header. Empty files are not PDFs.
export async function looksLikePdf(file) {
  if (!file || !file.size) return false;
  try {
    return hasPdfHeader(new Uint8Array(await file.slice(0, 1024).arrayBuffer()));
  } catch {
    return false;
  }
}

export function showAlert(container, type, message) {
  container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

export function setProgress(fillEl, labelEl, pct, label) {
  if (fillEl) fillEl.style.width = pct + '%';
  if (labelEl) labelEl.textContent = label;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoking synchronously can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsArrayBuffer(file);
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

export function setupDropZone(dropZone, fileInput, onFiles, accept = null) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    let files = Array.from(e.dataTransfer.files);
    if (accept) {
      files = files.filter(f => {
        if (accept === '.pdf') return f.type === 'application/pdf';
        if (accept === 'image/*') return f.type.startsWith('image/');
        return true;
      });
    }
    if (files.length) onFiles(files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) onFiles(Array.from(fileInput.files));
  });
}
