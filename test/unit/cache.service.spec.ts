import { describe, it, expect, vi } from 'vitest';
import { CacheService, normalizePagination } from '@/services/cache.service';

describe('CacheService & normalizePagination', () => {
  it('evicts the least recently used (LRU) entry when capacity is reached', () => {
    const cache = new CacheService(2, 10_000);

    cache.set('k1', 'v1');
    cache.set('k2', 'v2');

    // Access k1 so k2 becomes the least recently used entry
    expect(cache.get<string>('k1')).toBe('v1');

    // Adding k3 should evict k2, keeping k1
    cache.set('k3', 'v3');

    expect(cache.get<string>('k1')).toBe('v1');
    expect(cache.get<string>('k2')).toBeUndefined();
    expect(cache.get<string>('k3')).toBe('v3');
  });

  it('expires entries after TTL elapses', () => {
    vi.useFakeTimers();
    try {
      const cache = new CacheService(10, 1_000);
      cache.set('temp', 'data');

      expect(cache.get<string>('temp')).toBe('data');

      vi.advanceTimersByTime(1_001);
      expect(cache.get<string>('temp')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates fetcher calls with getOrSet', async () => {
    const cache = new CacheService(10, 10_000);
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const first = await cache.getOrSet('user:1', fetcher);
    const second = await cache.getOrSet('user:1', fetcher);

    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clamps pagination bounds and handles invalid inputs safely', () => {
    expect(normalizePagination(1, 50)).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
    });
    expect(normalizePagination(-5, 9999)).toEqual({
      page: 1,
      limit: 100,
      skip: 0,
    });
    expect(normalizePagination(3, 20)).toEqual({
      page: 3,
      limit: 20,
      skip: 40,
    });
    expect(normalizePagination(Number.NaN, Number.NaN)).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
    });
  });
});
