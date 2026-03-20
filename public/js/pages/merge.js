// Page controller: merge.html
import { mergePDFs } from '../services/pdfMerge.js';
    import { formatBytes } from '../utils/fileHandlers.js';
    import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
    import { saveToHistory } from '../config/firebase.js';

    const FREE_FILE_LIMIT  = FREE_LIMITS.pdfMergeFiles;
    const FREE_SIZE_LIMIT  = FREE_LIMITS.pdfFileSizeMB * 1024 * 1024;

    let files = [];

    initPaywall().then(premium => {
      if (premium) document.getElementById('freeLimitBanner').classList.add('hidden');
    });

    document.getElementById('upgradeLink').addEventListener('click', e => {
      e.preventDefault(); requirePremium('Merging more than 3 PDF files', 'pdf-merge');
    });
    document.getElementById('proCardBtn').addEventListener('click', () => {
      requirePremium('Merging more than 3 PDF files', 'pdf-merge');
    });

    function renderList() {
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      files.forEach((f, i) => {
        const oversized = !isPremium() && f.size > FREE_SIZE_LIMIT;
        const li = document.createElement('li');
        li.className = 'file-item'; li.draggable = true; li.dataset.index = i;
        li.innerHTML = `
          <span class="file-item-icon">${oversized ? '⚠️' : '📄'}</span>
          <span class="file-item-name" style="${oversized ? 'color:var(--warning)' : ''}">${f.name}${oversized ? ' — exceeds free 10MB limit' : ''}</span>
          <span class="file-item-size">${formatBytes(f.size)}</span>
          <button class="file-item-remove" data-i="${i}">✕</button>`;
        fileList.appendChild(li);
      });

      // Drag-to-reorder
      let dragSrc = null;
      fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('dragstart', () => { dragSrc = parseInt(item.dataset.index); item.style.opacity='0.4'; });
        item.addEventListener('dragend',   () => item.style.opacity='1');
        item.addEventListener('dragover',  e => { e.preventDefault(); item.style.borderColor='var(--emerald)'; });
        item.addEventListener('dragleave', () => item.style.borderColor='');
        item.addEventListener('drop', e => {
          e.preventDefault(); item.style.borderColor='';
          const t = parseInt(item.dataset.index);
          if (dragSrc !== t) { const m = files.splice(dragSrc,1)[0]; files.splice(t,0,m); renderList(); }
        });
      });
      fileList.querySelectorAll('.file-item-remove').forEach(btn => {
        btn.addEventListener('click', () => { files.splice(parseInt(btn.dataset.i),1); renderList(); updateState(); });
      });
      updateState();
    }

    function updateState() {
      const over = !isPremium() && files.length > FREE_FILE_LIMIT;
      document.getElementById('controls').classList.toggle('hidden', files.length < 2);
      document.getElementById('proCard').classList.toggle('hidden', !over);
    }

    function addFiles(newFiles) {
      files = [...files, ...Array.from(newFiles).filter(f => f.type==='application/pdf')];
      renderList();
    }

    const dropZone  = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', () => addFiles(fileInput.files));
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
    document.getElementById('clearBtn').addEventListener('click', () => { files=[]; renderList(); document.getElementById('alertArea').innerHTML=''; });

    document.getElementById('mergeBtn').addEventListener('click', async () => {
      if (files.length < 2) return;
      if (files.length > FREE_FILE_LIMIT && !isPremium()) {
        requirePremium(`Merging ${files.length} files (free limit: ${FREE_FILE_LIMIT})`, 'pdf-merge-count'); return;
      }
      const oversized = files.find(f => f.size > FREE_SIZE_LIMIT);
      if (oversized && !isPremium()) {
        requirePremium(`"${oversized.name}" is ${formatBytes(oversized.size)} — free limit is 10MB`, 'pdf-merge-size'); return;
      }

      document.getElementById('mergeBtn').disabled = true;
      document.getElementById('progressWrap').classList.remove('hidden');
      document.getElementById('alertArea').innerHTML = '';
      try {
        const outputName = document.getElementById('outputName').value || 'merged.pdf';
        const blob = await mergePDFs(files, (pct, label) => {
          document.getElementById('progressFill').style.width = pct+'%';
          document.getElementById('progressLabel').textContent = label;
        });
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href:url, download:outputName }).click();
        URL.revokeObjectURL(url);
        document.getElementById('alertArea').innerHTML = `<div class="alert alert-success">✅ Merged ${files.length} files — downloading <strong>${outputName}</strong></div>`;
        await saveToHistory('pdf-merge', { fileCount: files.length, outputName, totalSizeBytes: files.reduce((s,f)=>s+f.size,0) });
      } catch (err) {
        document.getElementById('alertArea').innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
      } finally {
        document.getElementById('mergeBtn').disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
        document.getElementById('progressFill').style.width = '0%';
      }
    });
