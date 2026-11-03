// CQA-PDF-PREVIEW-URL-LIFETIME: every preview rerender must release the blob URLs of the previous render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/fake-dom.mjs';

const img = name => ({ name, type: 'image/png', arrayBuffer: async () => new ArrayBuffer(1) });

test('images-to-pdf: rerenders and clear revoke abandoned preview blob URLs', async () => {
  const els = installDom();
  let n = 0;
  const live = new Set();
  URL.createObjectURL = () => { const u = `blob:${++n}`; live.add(u); return u; };
  URL.revokeObjectURL = u => { live.delete(u); };

  await import('../public/js/pages/images-to-pdf.js?urls1');
  const input = els.get('fileInput');
  input.files = [img('a'), img('b')]; input.fire('change');
  assert.equal(live.size, 2);
  input.files = [img('c')]; input.fire('change'); // rerender: 3 previews now, the first 2 URLs are abandoned
  assert.equal(live.size, 3, 'only the current render holds URLs');
  els.get('clearBtn').click();
  assert.equal(live.size, 0, 'clear releases every URL');
});
