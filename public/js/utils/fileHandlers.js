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
