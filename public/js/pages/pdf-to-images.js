// Page controller: pdf-to-images.html
import { pdfToImages } from '../services/pdfToImages.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { saveToHistory } from '../config/firebase.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const controls = document.getElementById('controls');
    const convertBtn = document.getElementById('convertBtn');
    const progressWrap = document.getElementById('progressWrap');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');
    const alertArea = document.getElementById('alertArea');
    const previewGrid = document.getElementById('previewGrid');
    const qualitySlider = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    let currentFile = null;
initPaywall();

    qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });

    function loadFile(f) {
      currentFile = f;
      controls.classList.remove('hidden');
      previewGrid.innerHTML = '';
      alertArea.innerHTML = '';
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type === 'application/pdf') loadFile(f);
    });

    convertBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      if (currentFile && currentFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024 && !isPremium()) {
        requirePremium(`Converting PDFs over 10MB to images requires Pro`, 'pdf-to-images-size');
        return;
      }
      
      progressWrap.classList.remove('hidden');
      previewGrid.innerHTML = '';
      alertArea.innerHTML = '';
      try {
        const format = document.getElementById('format').value;
        const quality = parseInt(qualitySlider.value) / 100;
        const scale = parseFloat(document.getElementById('scale').value);
        const images = await pdfToImages(currentFile, { format, quality, scale }, (pct, label) => {
          progressFill.style.width = pct + '%';
          progressLabel.textContent = label;
        });

        images.forEach((dataUrl, i) => {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'background:var(--slate-800);border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;';
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.cssText = 'width:100%;display:block;';
          const info = document.createElement('div');
          info.style.cssText = 'padding:8px;display:flex;justify-content:space-between;align-items:center;';
          info.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--slate-400);">Page ${i+1}</span>`;
          const dlBtn = document.createElement('a');
          dlBtn.href = dataUrl;
          dlBtn.download = `page-${i+1}.${format === 'jpeg' ? 'jpg' : 'png'}`;
          dlBtn.textContent = '⬇️';
          dlBtn.style.cssText = 'font-size:0.8rem;text-decoration:none;';
          info.appendChild(dlBtn);
          wrap.appendChild(img);
          wrap.appendChild(info);
          previewGrid.appendChild(wrap);
        });

        alertArea.innerHTML = `<div class="alert alert-success">✅ Converted ${images.length} page${images.length>1?'s':''}.</div>`;
        await saveToHistory('pdf-to-images', { pages: images.length, format, scale });
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
      } finally {
        convertBtn.disabled = false;
        progressWrap.classList.add('hidden');
      }
    });
