import { LRUCache } from 'lru-cache';

export interface CacheOptions {
  max: number;
  ttl: number;
}

export type CacheKey = string;

export interface CacheEntry<TValue> {
  key: CacheKey;
  value: TValue;
}

export class ResponseCache<TValue> {
  private readonly cache: LRUCache<CacheKey, TValue>;

  constructor(options: CacheOptions) {
    this.cache = new LRUCache<CacheKey, TValue>({
      max: options.max,
      ttl: options.ttl
    });
  }

  public get(key: CacheKey): TValue | undefined {
    return this.cache.get(key);
  }

  public set(key: CacheKey, value: TValue): void {
    this.cache.set(key, value);
  }

  public delete(key: CacheKey): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const createCacheKey = (url: string, params?: Record<string, unknown>): CacheKey => {
  if (!params) {
    return url;
  }
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));

  const serializedParams = new URLSearchParams();
  for (const [key, value] of sortedEntries) {
    serializedParams.append(key, String(value));
  }

  const query = serializedParams.toString();
  return query ? `${url}?${query}` : url;
};
