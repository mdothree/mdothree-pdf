// CQA-MDOTHREE-PDF-LOAD-ORDER: a late parse must not replace a newer selection or a cleared state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, tick, deferred, until } from './helpers/fake-dom.mjs';

const pdfFile = (name, size) => ({ name, size, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(size) });

test('split: late parse of an older file does not replace the newer selection', async () => {
  const els = installDom();
  const pending = {};
  globalThis.__PDFDocument = { load: buf => (pending[buf.byteLength] = deferred()).promise };
  await import('../public/js/pages/split.js?order1');
  const input = els.get('fileInput');
  input.files = [pdfFile('a.pdf', 1)]; input.fire('change');
  await until(() => pending[1]);
  input.files = [pdfFile('b.pdf', 2)]; input.fire('change');
  await until(() => pending[2]);
  pending[2].resolve({ getPageCount: () => 7 });
  await tick();
  assert.equal(els.get('fileName').textContent, 'b.pdf');
  pending[1].resolve({ getPageCount: () => 3 });
  await tick();
  assert.equal(els.get('fileName').textContent, 'b.pdf');
  assert.equal(els.get('pageCount').textContent, '7 pages');
});

test('split: late parse completion does not resurrect a cleared state', async () => {
  const els = installDom();
  const pending = {};
  globalThis.__PDFDocument = { load: buf => (pending[buf.byteLength] = deferred()).promise };
  await import('../public/js/pages/split.js?order2');
  const input = els.get('fileInput');
  input.files = [pdfFile('a.pdf', 5)]; input.fire('change');
  await until(() => pending[5]);
  els.get('clearBtn').click();
  pending[5].resolve({ getPageCount: () => 3 });
  await tick();
  assert.equal(els.get('controls').classList.contains('hidden'), true);
  assert.equal(els.get('fileInfo').classList.contains('hidden'), true);
});
