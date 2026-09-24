const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { once } = require('node:events');
const { withDownload, streamBody, streamZip } = require('../dist/downloads');
const { route, errorHandler, HttpError } = require('../dist/errors');

async function listen(server, t) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t) {
  let cancellations = 0;
  const upstream = await listen(http.createServer((req, res) => {
    if (req.url === '/headers') {
      res.on('close', () => cancellations++);
      return;
    }
    if (req.url === '/ok') { res.end('complete attachment'); return; }
    res.writeHead(200, { 'Content-Length': '1000000' });
    res.write('partial attachment');
    if (req.url === '/broken') setTimeout(() => res.destroy(), 25);
    else res.on('close', () => cancellations++);
  }), t);
  const app = express();
  let caught = 0;
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/:kind/:mode', route(async (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename=test');
    await withDownload(res, async signal => {
      const load = path => fetch(`${upstream}/${path}`, { signal });
      if (req.params.kind === 'single') {
        const response = await load(req.params.mode);
        await streamBody(response.body, res, signal);
      } else {
        async function* entries() {
          const response = await load(req.params.mode === 'later' ? 'slow' : req.params.mode === 'pending' ? 'broken' : req.params.mode);
          yield { name: 'first.txt', body: response.body };
          if (req.params.mode === 'later') throw new HttpError(502, 'attachment_download_failed');
          const second = await load(req.params.mode === 'pending' ? 'headers' : 'ok');
          yield { name: 'second.txt', body: second.body };
        }
        await streamZip(entries(), res, signal);
      }
    });
  }));
  app.use((err, req, res, next) => { caught++; errorHandler(err, req, res, next); });
  const base = await listen(http.createServer(app), t);
  return { base, cancellations: () => cancellations, caught: () => caught };
}

async function until(check) {
  for (let n = 0; n < 100; n++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for cancellation/error handling');
}

for (const kind of ['single', 'zip']) {
  test(`${kind}: successful download completes`, { timeout: 5000 }, async t => {
    const f = await fixture(t);
    const response = await fetch(`${f.base}/${kind}/ok`);
    const body = Buffer.from(await response.arrayBuffer());
    if (kind === 'single') assert.equal(body.toString(), 'complete attachment');
    else {
      assert.equal(body.readUInt32LE(0), 0x04034b50);
      assert.equal(body.readUInt32LE(body.length - 22), 0x06054b50);
      assert.equal(body.readUInt16LE(body.length - 12), 2);
    }
    assert.equal(f.caught(), 0);
  });
  test(`${kind}: upstream truncation fails only the download`, { timeout: 5000 }, async t => {
    const f = await fixture(t);
    await assert.rejects(async () => {
      const response = await fetch(`${f.base}/${kind}/broken`);
      await response.arrayBuffer();
    });
    await until(() => f.caught() === 1);
    assert.equal((await fetch(`${f.base}/health`)).status, 200);
  });
  for (const mode of ['slow', 'headers']) {
    test(`${kind}: client disconnect cancels upstream (${mode})`, { timeout: 5000 }, async t => {
      const f = await fixture(t);
      const request = http.get(`${f.base}/${kind}/${mode}`);
      request.on('error', () => {});
      request.on('response', res => res.on('error', () => {}));
      await new Promise(resolve => setTimeout(resolve, 100));
      request.destroy();
      await until(() => f.cancellations() > 0 && f.caught() === 1);
      assert.equal((await fetch(`${f.base}/health`)).status, 200);
    });
  }
}

test('ZIP: later fetch failure cancels already appended sources', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  await assert.rejects(async () => {
    const response = await fetch(`${f.base}/zip/later`);
    await response.arrayBuffer();
  });
  await until(() => f.cancellations() === 1 && f.caught() === 1);
  assert.equal((await fetch(`${f.base}/health`)).status, 200);
});

test('error handler delegates after headers, skips closed responses and clears download headers', () => {
  const error = new Error('stream failed');
  let delegated;
  errorHandler(error, {}, { headersSent: true }, e => delegated = e);
  assert.equal(delegated, error);
  errorHandler(error, {}, { destroyed: true }, () => assert.fail('closed response delegated'));
  const removed = [];
  const res = { removeHeader: name => removed.push(name), status: code => {
    assert.equal(code, 502); return res;
  }, json: body => assert.deepEqual(body, { error: 'attachment_download_failed' }) };
  errorHandler(new HttpError(502, 'attachment_download_failed'), {}, res, () => {});
  assert.deepEqual(removed, ['Content-Length', 'Content-Disposition', 'Content-Type']);
});

test('ZIP: stream failure cancels a pending fetch for the next entry', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  await assert.rejects(async () => {
    const response = await fetch(`${f.base}/zip/pending`);
    await response.arrayBuffer();
  });
  await until(() => f.cancellations() === 1 && f.caught() === 1);
  assert.equal((await fetch(`${f.base}/health`)).status, 200);
});
