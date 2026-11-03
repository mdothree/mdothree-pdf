// CQA-PDF-MUTABLE-JOB-INPUT: removing an image while a conversion is running must not skip or duplicate pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/fake-dom.mjs';

const img = name => ({ name, type: 'image/png', arrayBuffer: async () => new TextEncoder().encode(name).buffer });

test('images-to-pdf: in-flight conversion embeds exactly the images selected at click time', async () => {
  const els = installDom();
  const embedded = [];
  globalThis.__PDFDocument = {
    create: async () => {
      let pages = 0;
      return {
        embedPng: async bytes => { embedded.push(new TextDecoder().decode(bytes)); return { scale: () => ({ width: 10, height: 10 }) }; },
        addPage: () => { pages++; return { getWidth: () => 595, getHeight: () => 842, drawImage() {} }; },
        getPageCount: () => pages,
        save: async () => new Uint8Array([1]),
      };
    },
  };
  let n = 0;
  URL.createObjectURL = () => `blob:${++n}`;
  URL.revokeObjectURL = () => {};

  await import('../public/js/pages/images-to-pdf.js?job1');
  document.getElementById('pageSize').value = 'a4';
  document.getElementById('outputName').value = 'x.pdf';
  els.get('fileInput').files = [img('one'), img('two'), img('three')];
  els.get('fileInput').fire('change');
  assert.equal(els.get('previewGrid').children.length, 3);
  const removeFirst = els.get('previewGrid').children[0].children.find(c => c.textContent === '✕');

  const convert = els.get('convertBtn').click();
  await tick(1);
  removeFirst.click(); // user removes "one" while the first image is still being read
  await convert;
  await tick();
  assert.deepEqual(embedded, ['one', 'two', 'three']);
});
