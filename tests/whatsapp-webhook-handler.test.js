import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import handler from '../api/webhook/whatsapp.js';

function responseStub() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function requestStub({ method = 'POST', headers = {}, chunks = [] } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = headers;
  queueMicrotask(() => {
    for (const chunk of chunks) req.emit('data', chunk);
    req.emit('end');
  });
  return req;
}

test('WhatsApp webhook rejects oversized Content-Length before reading the body', async () => {
  const previous = process.env.WEBHOOK_SECRET;
  process.env.WEBHOOK_SECRET = 'handler-test-secret';
  try {
    const req = requestStub({
      headers: { 'content-length': String(1024 * 1024 + 1) }
    });
    const res = responseStub();
    await handler(req, res);
    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.body, { error: 'webhook_body_too_large' });
  } finally {
    if (previous === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previous;
  }
});

test('WhatsApp webhook rejects oversized streamed body without allocating the full payload', async () => {
  const previous = process.env.WEBHOOK_SECRET;
  process.env.WEBHOOK_SECRET = 'handler-test-secret';
  try {
    const req = requestStub({
      headers: {},
      chunks: [Buffer.alloc(1024 * 1024 + 1)]
    });
    const res = responseStub();
    await handler(req, res);
    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.body, { error: 'webhook_body_too_large' });
  } finally {
    if (previous === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previous;
  }
});
