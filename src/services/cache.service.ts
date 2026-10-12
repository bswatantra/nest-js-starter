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
  private readonly maxEntries = 1000;
  private readonly defaultTtlMs = Number(process.env['CACHE_TTL_MS'] ?? 5_000);

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
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

    const value = await fetcher();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
