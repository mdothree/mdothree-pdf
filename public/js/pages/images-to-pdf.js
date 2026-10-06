// Page controller: images-to-pdf.html
import { imagesToPDF } from '../services/imagesToPdf.js';
import { initPaywall, isPremium, requirePremium, FREE_LIMITS } from '../stripe-paywall.js';
import { saveToHistory } from '../config/firebase.js';
    import { formatBytes, downloadBlob } from '../utils/fileHandlers.js';

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewGrid = document.getElementById('previewGrid');
    const controls = document.getElementById('controls');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const alertArea = document.getElementById('alertArea');
    let files = [];
    let dragSrc = null;
initPaywall();

    function renderPreviews() {
      previewGrid.innerHTML = '';
      files.forEach((f, i) => {
        const url = URL.createObjectURL(f);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative;background:var(--slate-800);border-radius:8px;overflow:hidden;cursor:grab;';
        wrap.draggable = true;
        wrap.dataset.index = i;
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;display:block;';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'padding:6px 8px;font-family:var(--font-mono);font-size:0.7rem;color:var(--slate-400);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        lbl.textContent = f.name;
        const rm = document.createElement('button');
        rm.textContent = '✕';
        rm.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:white;cursor:pointer;border-radius:4px;width:22px;height:22px;font-size:0.8rem;';
        rm.addEventListener('click', () => {
        const blobSrc = img.src;
        files.splice(i,1); renderPreviews();
        if (blobSrc.startsWith('blob:')) URL.revokeObjectURL(blobSrc);
      });
        // Drag-to-reorder (the page copy promises it; same pattern as merge.js)
        wrap.addEventListener('dragstart', e => { dragSrc = i; wrap.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; });
        wrap.addEventListener('dragend', () => { wrap.style.opacity = '1'; dragSrc = null; });
        wrap.addEventListener('dragover', e => { if (dragSrc !== null) { e.preventDefault(); e.stopPropagation(); } });
        wrap.addEventListener('drop', e => {
          if (dragSrc === null) return;
          e.preventDefault(); e.stopPropagation();
          if (dragSrc !== i) { const m = files.splice(dragSrc, 1)[0]; files.splice(i, 0, m); }
          dragSrc = null; renderPreviews();
        });
        wrap.appendChild(img); wrap.appendChild(lbl); wrap.appendChild(rm);
        previewGrid.appendChild(wrap);
      });
      controls.classList.toggle('hidden', files.length === 0);
    }

    function addFiles(newFiles) {
      const all = Array.from(newFiles);
      const images = all.filter(f => f.type.startsWith('image/'));
      alertArea.innerHTML = '';
      if (images.length < all.length) {
        const div = document.createElement('div');
        div.className = 'alert alert-error';
        div.textContent = `❌ ${all.length - images.length} file${all.length - images.length > 1 ? 's were' : ' was'} skipped — only image files (JPG, PNG, WebP, GIF) can be added.`;
        alertArea.appendChild(div);
      }
      files = [...files, ...images];
      renderPreviews();
    }

    fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      addFiles(e.dataTransfer.files);
    });

    clearBtn.addEventListener('click', () => { files = []; renderPreviews(); alertArea.innerHTML = ''; });

    convertBtn.addEventListener('click', async () => {
      if (!files.length) return;
      convertBtn.disabled = true;
      document.getElementById('progressWrap').classList.remove('hidden');
      alertArea.innerHTML = '';
      try {
        const pageSize = document.getElementById('pageSize').value;
        const outputName = document.getElementById('outputName').value || 'images.pdf';
        const blob = await imagesToPDF(files, { pageSize }, (pct, label) => {
          document.getElementById('progressFill').style.width = pct + '%';
          document.getElementById('progressLabel').textContent = label;
        });
        downloadBlob(blob, /\.pdf$/i.test(outputName) ? outputName : `${outputName}.pdf`);
        const pages = blob.pageCount ?? files.length;
        const skipped = blob.skipped || [];
        alertArea.innerHTML = '';
        const div = document.createElement('div');
        div.className = skipped.length ? 'alert alert-info' : 'alert alert-success';
        div.textContent = `✅ Created PDF with ${pages} page${pages > 1 ? 's' : ''}.` +
          (skipped.length ? ` Skipped ${skipped.length} image${skipped.length > 1 ? 's' : ''} that couldn't be read: ${skipped.join(', ')}` : '');
        alertArea.appendChild(div);
        await saveToHistory('images-to-pdf', { imageCount: pages, pageSize });
      } catch (err) {
        alertArea.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'alert alert-error';
        div.textContent = `❌ ${err.message}`;
        alertArea.appendChild(div);
      } finally {
        convertBtn.disabled = false;
        document.getElementById('progressWrap').classList.add('hidden');
      }
    });
