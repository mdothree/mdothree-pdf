// Page controller: compress.html
import { compressPDF } from '../services/pdfCompress.js';
    import { formatBytes, downloadBlob, isPdfFile } from '../utils/fileHandlers.js';
    import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { saveToHistory } from '../config/firebase.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const qualitySlider = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    const compressBtn = document.getElementById('compressBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const alertArea = document.getElementById('alertArea');
    let currentFile = null, compressedBlob = null, outputIsOriginal = false;
    const FREE_SIZE = FREE_LIMITS.pdfFileSizeMB * 1024 * 1024;
    initPaywall().then(p => { if(p) { const b=document.getElementById('freeBanner'); if(b) b.remove(); } });

    qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

    function loadFile(file) {
      if (!isPdfFile(file)) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ That file isn't a PDF. Drop a .pdf file to compress it.</div>`;
        return;
      }
      alertArea.innerHTML = '';
      currentFile = file;
      compressedBlob = null;
      document.getElementById('resultPanel').style.display = 'none';
      downloadBtn.style.display = 'none';
      document.getElementById('fileName').textContent = file.name;
      document.getElementById('fileSize').textContent = formatBytes(file.size);
      document.getElementById('fileInfo').classList.remove('hidden');
      document.getElementById('settings').style.display = 'block';
      document.getElementById('origSize').textContent = formatBytes(file.size);
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    });

    compressBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      compressBtn.disabled = true;
      document.getElementById('progressWrap').classList.remove('hidden');
      alertArea.innerHTML = '';
      try {
        const quality = parseInt(qualitySlider.value) / 100;
        const scale = parseFloat(document.getElementById('scaleSelect')?.value || '1.5');
        const removeMetadata = document.getElementById('removeMetadata').checked;
        compressedBlob = await compressPDF(currentFile, { quality, scale, removeMetadata }, (pct, label) => {
          document.getElementById('progressFill').style.width = pct + '%';
          document.getElementById('progressLabel').textContent = label;
        });
        const reduction = (((currentFile.size - compressedBlob.size) / currentFile.size) * 100).toFixed(1);
        const savings = document.getElementById('savings');
        if (compressedBlob.size >= currentFile.size) {
          // Re-rendering made it bigger (common for text-only PDFs). Don't hand
          // the user a larger file labelled "compressed" — offer the original.
          outputIsOriginal = true;
          compressedBlob = currentFile;
          document.getElementById('newSize').textContent = formatBytes(currentFile.size);
          savings.textContent = '0%';
          savings.classList.remove('text-emerald');
          downloadBtn.textContent = '⬇️ Download original';
          alertArea.innerHTML = `<div class="alert alert-info">ℹ️ This PDF is already compact — compressing it would make it larger, so your original file is kept. Try a lower quality setting if you need it smaller.</div>`;
        } else {
          outputIsOriginal = false;
          document.getElementById('newSize').textContent = formatBytes(compressedBlob.size);
          savings.textContent = `-${reduction}%`;
          savings.classList.add('text-emerald');
          downloadBtn.textContent = '⬇️ Download';
          alertArea.innerHTML = `<div class="alert alert-success">✅ Compressed! Saved ${reduction}%</div>`;
        }
        document.getElementById('resultPanel').style.display = 'block';
        downloadBtn.style.display = 'flex';
        await saveToHistory('pdf-compress', { originalSize: currentFile.size, compressedSize: compressedBlob.size, reduction });
      } catch (err) {
        alertArea.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'alert alert-error';
        div.textContent = `❌ Could not compress this PDF: ${err.message}`;
        alertArea.appendChild(div);
      } finally {
        compressBtn.disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (!compressedBlob) return;
      const base = (currentFile?.name || 'document.pdf').replace(/\.pdf$/i, '');
      downloadBlob(compressedBlob, outputIsOriginal ? `${base}.pdf` : `${base}-compressed.pdf`);
    });
