'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('in-flight GET requests reuse the same promise', async () => {
  const brandDataCache = new Map();
  const brandDataInflight = new Map();
  const cacheKey = (url) => 'brand:' + url;
  let fetchCount = 0;

  async function fetchCachedJson(url) {
    const key = cacheKey(url);
    const cached = brandDataCache.get(key);
    if (cached && Date.now() - cached.ts < 60000) return cached.data;

    const inflight = brandDataInflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      fetchCount += 1;
      await new Promise((r) => setTimeout(r, 20));
      const data = { ok: true };
      brandDataCache.set(key, { ts: Date.now(), data });
      return data;
    })().finally(() => {
      brandDataInflight.delete(key);
    });

    brandDataInflight.set(key, promise);
    return promise;
  }

  const [a, b] = await Promise.all([
    fetchCachedJson('/api/v1/analytics/x'),
    fetchCachedJson('/api/v1/analytics/x')
  ]);
  assert.equal(fetchCount, 1);
  assert.deepEqual(a, b);
});
