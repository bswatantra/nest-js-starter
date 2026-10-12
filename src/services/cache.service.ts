import 'dotenv/config';
import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const CACHE_KEYS = {
  USERS_LIST_PREFIX: 'users:list:',
  USERS_ID_PREFIX: 'users:id:',
  POSTS_PREFIX: 'posts:',
  POSTS_LIST_PREFIX: 'posts:list:',
  POSTS_ID_PREFIX: 'posts:id:',
  POSTS_AUTHOR_PREFIX: 'posts:author:',
  userList: (page: number, limit: number): string =>
    `users:list:${page}:${limit}`,
  userId: (id: number): string => `users:id:${id}`,
  postList: (page: number, limit: number): string =>
    `posts:list:${page}:${limit}`,
  postId: (id: number): string => `posts:id:${id}`,
  postByAuthor: (authorId: number): string => `posts:author:${authorId}`,
} as const;

export function normalizePagination(
  rawPage = 1,
  rawLimit = 50,
): PaginationParams {
  const parsedPage = Number(rawPage);
  const parsedLimit = Number(rawLimit);
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit >= 1
      ? Math.min(100, Math.floor(parsedLimit))
      : 50;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(maxEntries = 1000, defaultTtlMs?: number) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs =
      defaultTtlMs ?? Number(process.env['CACHE_TTL_MS'] ?? 5_000);
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh key position for O(1) Least Recently Used (LRU) ordering
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    this.inFlight.delete(key);

    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const lruKey = this.store.keys().next().value;
      if (lruKey !== undefined) {
        this.store.delete(lruKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const existingPromise = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingPromise !== undefined) {
      return existingPromise;
    }

    const fetchPromise = fetcher()
      .then((value) => {
        if (this.inFlight.get(key) === fetchPromise) {
          this.set(key, value, ttlMs);
        }
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === fetchPromise) {
          this.inFlight.delete(key);
        }
      });

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  delete(key: string): void {
    this.store.delete(key);
    this.inFlight.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) {
        this.inFlight.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }
}
