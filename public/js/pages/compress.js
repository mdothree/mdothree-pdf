// Page controller: compress.html
import { compressPDF } from '../services/pdfCompress.js';
    import { formatBytes } from '../utils/fileHandlers.js';
    import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { saveToHistory } from '../config/firebase.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const qualitySlider = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    const compressBtn = document.getElementById('compressBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const alertArea = document.getElementById('alertArea');
    let currentFile = null, compressedBlob = null;
    const FREE_SIZE = FREE_LIMITS.pdfFileSizeMB * 1024 * 1024;
    initPaywall().then(p => { if(p) { const b=document.getElementById('freeBanner'); if(b) b.remove(); } });

    qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

    function loadFile(file) {
      currentFile = file;
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
      if (f?.type === 'application/pdf') loadFile(f);
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
        document.getElementById('newSize').textContent = formatBytes(compressedBlob.size);
        document.getElementById('savings').textContent = `-${reduction}%`;
        document.getElementById('resultPanel').style.display = 'block';
        downloadBtn.style.display = 'flex';
        alertArea.innerHTML = `<div class="alert alert-success">✅ Compressed! Saved ${reduction}%</div>`;
        await saveToHistory('pdf-compress', { originalSize: currentFile.size, compressedSize: compressedBlob.size, reduction });
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
      } finally {
        compressBtn.disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (!compressedBlob) return;
      const url = URL.createObjectURL(compressedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = 'compressed.pdf'; a.click();
      URL.revokeObjectURL(url);
    });
