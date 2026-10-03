import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('runtime readiness SQL is joined with actual newlines', async () => {
  const source = await fs.readFile(new URL('../src/runtime/http-server.js', import.meta.url), 'utf8');

  assert.match(source, /\]\.?join\('\n'\)/);
  assert.doesNotMatch(source, /\]\.?join\('\\\\n'\)/);
});
