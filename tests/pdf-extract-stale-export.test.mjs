// CQA-PDF-EXTRACT-STALE-EXPORT: a failed new extraction must not leave the previous text exportable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick } from './helpers/fake-dom.mjs';

const pdfFile = name => ({ name, size: 10, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(10) });

test('extract-text: failed second extraction cannot download or copy the first document text', async () => {
  const els = installDom();
  let fail = false;
  globalThis.__pdfjs = {
    getDocument: () => ({
      promise: fail
        ? Promise.reject(new Error('Invalid PDF structure'))
        : Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'OLD-DOCUMENT-TEXT', hasEOL: false }] }) }) }),
    }),
  };
  const blobs = [], copied = [];
  URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async t => { copied.push(t); } } }, configurable: true });

  await import('../public/js/pages/extract-text.js?stale1');
  const input = els.get('fileInput');
  input.files = [pdfFile('a.pdf')]; input.fire('change');
  await els.get('extractBtn').click();
  await tick();
  assert.match(els.get('textOutput').textContent, /OLD-DOCUMENT-TEXT/);
  assert.equal(els.get('outputActions').style.display, 'flex');

  fail = true;
  input.files = [pdfFile('b.pdf')]; input.fire('change');
  await els.get('extractBtn').click();
  await tick();
  assert.equal(els.get('textOutput').textContent, 'Error during extraction.');
  assert.equal(els.get('outputActions').style.display, 'none');
  await els.get('downloadTxtBtn').click();
  await els.get('copyBtn').click();
  assert.equal(blobs.length, 0, 'no download of stale text');
  assert.equal(copied.length, 0, 'no copy of stale text');
});
