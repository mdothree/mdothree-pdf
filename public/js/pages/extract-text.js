// Page controller: extract-text.html
import { extractText } from '../services/textExtract.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { saveToHistory } from '../config/firebase.js';
    import { formatBytes } from '../utils/fileHandlers.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const extractBtn = document.getElementById('extractBtn');
    const textOutput = document.getElementById('textOutput');
    const copyBtn = document.getElementById('copyBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const alertArea = document.getElementById('alertArea');
    let currentFile = null, extractedText = '';
initPaywall();

    function loadFile(f) {
      currentFile = f;
      document.getElementById('fileName').textContent = f.name;
      document.getElementById('pageCount').textContent = formatBytes(f.size);
      document.getElementById('fileInfo').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f?.type === 'application/pdf') loadFile(f);
    });

    extractBtn.addEventListener('click', async () => {
      if (!currentFile) return;
      if (currentFile && currentFile.size > FREE_LIMITS.pdfFileSizeMB * 1024 * 1024 && !isPremium()) {
        requirePremium(\`Extracting text from files over 10MB requires Pro\`, 'pdf-extract-size');
        return;
      }
      
      document.getElementById('progressWrap').classList.remove('hidden');
      alertArea.innerHTML = '';
      textOutput.style.fontStyle = 'italic';
      textOutput.textContent = 'Extracting...';
      try {
        const pageRange = document.getElementById('pageRange').value;
        extractedText = await extractText(currentFile, { pageRange }, (pct, label) => {
          document.getElementById('progressFill').style.width = pct + '%';
          document.getElementById('progressLabel').textContent = label;
        });
        textOutput.style.fontStyle = 'normal';
        textOutput.style.color = 'var(--slate-300)';
        textOutput.textContent = extractedText;
        const words = extractedText.trim().split(/\s+/).filter(Boolean).length;
        document.getElementById('wordCount').textContent = words.toLocaleString();
        document.getElementById('charCount').textContent = extractedText.length.toLocaleString();
        document.getElementById('statsPanel').style.display = 'block';
        document.getElementById('outputActions').style.display = 'flex';
        await saveToHistory('pdf-extract-text', { words, chars: extractedText.length });
      } catch (err) {
        alertArea.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
        textOutput.textContent = 'Error during extraction.';
      } finally {
        extractBtn.disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
      }
    });

    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(extractedText);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });

    downloadTxtBtn.addEventListener('click', () => {
      const blob = new Blob([extractedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'extracted.txt'; a.click();
      URL.revokeObjectURL(url);
    });
