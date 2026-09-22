import test from 'node:test';
import assert from 'node:assert/strict';

function atomicAdmission() {
  let admitted = false;
  return async () => {
    await new Promise((resolve) => setImmediate(resolve));
    if (admitted) return false;
    admitted = true;
    return true;
  };
}

test('concurrent replay contract requires exactly one admission', async () => {
  const acceptIfAbsent = atomicAdmission();
  const results = await Promise.all(Array.from({ length: 10 }, () => acceptIfAbsent('same-key')));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.filter((value) => !value).length, 9);
});
