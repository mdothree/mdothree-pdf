// Page controller: split.html
import { splitPDF } from '../services/pdfSplit.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { saveToHistory } from '../config/firebase.js';
    import { formatBytes } from '../utils/fileHandlers.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const controls = document.getElementById('controls');
    const splitBtn = document.getElementById('splitBtn');
    const clearBtn = document.getElementById('clearBtn');
    const progressWrap = document.getElementById('progressWrap');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');
    const alertArea = document.getElementById('alertArea');
    let currentFile = null;
initPaywall();;
    let totalPages = 0;
    let currentMode = 'range';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        document.getElementById('modeRange').classList.toggle('hidden', currentMode !== 'range');
        document.getElementById('modeEach').classList.toggle('hidden', currentMode !== 'each');
        document.getElementById('modeSplit').classList.toggle('hidden', currentMode !== 'split');
      });
    });

    async function loadFile(file) {
      currentFile = file;
      document.getElementById('fileName').textContent = file.name;
      document.getElementById('fileSize').textContent = formatBytes(file.size);
      const { PDFDocument } = await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);
      totalPages = pdf.getPageCount();
      document.getElementById('pageCount').textContent = `${totalPages} pages`;
      fileInfo.classList.remove('hidden');
      controls.classList.remove('hidden');
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type === 'application/pdf') loadFile(f);
    });

    clearBtn.addEventListener('click', () => {
      currentFile = null; totalPages = 0;
      fileInfo.classList.add('hidden'); controls.classList.add('hidden');
      alertArea.innerHTML = '';
    });

    splitBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      splitBtn.disabled = true;
      progressWrap.classList.remove('hidden');
      alertArea.innerHTML = '';
      try {
        await splitPDF(currentFile, currentMode, {
          pageRange: document.getElementById('pageRange').value,
          splitAt: parseInt(document.getElementById('splitAt').value)
        }, (pct, label) => {
          progressFill.style.width = pct + '%';
          progressLabel.textContent = label;
        });
        alertArea.innerHTML = `<div class="alert alert-success">✅ Done! Check your downloads.</div>`;
        await saveToHistory('pdf-split', { mode: currentMode });
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
      } finally {
        splitBtn.disabled = false;
        progressWrap.classList.add('hidden');
      }
    });
