import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CacheService, normalizePagination } from '@/services/cache.service';

describe('CacheService & normalizePagination', () => {
  it('can be instantiated by the NestJS DI container without arguments', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    const cache = moduleRef.get<CacheService>(CacheService);
    expect(cache).toBeInstanceOf(CacheService);
  });

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

  it('deduplicates sequential and concurrent (in-flight stampede) fetcher calls with getOrSet', async () => {
    const cache = new CacheService(10, 10_000);
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<{ id: number }>((resolve) => {
          setTimeout(() => resolve({ id: 1 }), 20);
        }),
    );

    // Fire 10 concurrent calls while cache is cold
    const results = await Promise.all(
      Array.from({ length: 10 }, () => cache.getOrSet('user:1', fetcher)),
    );

    for (const res of results) {
      expect(res).toEqual({ id: 1 });
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite cache if key is invalidated while a read is in flight', async () => {
    const cache = new CacheService(10, 10_000);
    let resolveRead: ((val: string) => void) | undefined;

    const readPromise = cache.getOrSet(
      'user:1',
      () =>
        new Promise<string>((resolve) => {
          resolveRead = resolve;
        }),
    );

    // Concurrent delete/invalidation happens before the in-flight read finishes
    cache.delete('user:1');

    resolveRead?.('stale-value');
    const result = await readPromise;

    expect(result).toBe('stale-value');
    expect(cache.get<string>('user:1')).toBeUndefined();
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
