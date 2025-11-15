import pRetry from 'p-retry';
import { fetch } from 'undici';
import { z } from 'zod';

import { ResponseCache, createCacheKey } from './cache.js';
import type { AppConfig } from './config.js';
import { consumeRateLimit, type RateLimiter } from './rate.js';
import { checksumAddress } from './utils.js';

const jsonObjectSchema = z.object({}).passthrough();
const jsonArraySchema = z.array(z.unknown());
type JsonObject = z.infer<typeof jsonObjectSchema>;

interface RequestOptions {
  query?: Record<string, unknown>;
  usePost?: boolean;
  body?: Record<string, unknown>;
  cache?: boolean;
}

export class BlockscoutClient {
  private readonly cache: ResponseCache<unknown>;

  constructor(private readonly config: AppConfig, private readonly rateLimiter: RateLimiter) {
    this.cache = new ResponseCache<unknown>({
      max: config.cacheMax,
      ttl: config.cacheTtlMs
    });
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const sanitizedPath = path.startsWith('/') ? path.slice(1) : path;
    const baseUrl = this.config.blockscoutBaseUrl.endsWith('/')
      ? this.config.blockscoutBaseUrl
      : `${this.config.blockscoutBaseUrl}/`;
    const url = new URL(sanitizedPath, baseUrl);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const cacheKey = createCacheKey(`${url.origin}${url.pathname}`, options.query);

    if (this.config.blockscoutApiKey) {
      url.searchParams.set('apikey', this.config.blockscoutApiKey);
    }

    if (options.cache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return schema.parse(cached);
      }
    }

    const execute = async (): Promise<T> => {
      await consumeRateLimit(this.rateLimiter);
      const response = await fetch(url.toString(), {
        method: options.usePost ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: options.usePost ? JSON.stringify(options.body ?? {}) : undefined
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Blockscout request failed (${response.status}): ${text}`);
      }

      const payload: unknown = await response.json();
      return schema.parse(payload);
    };

    const result = await pRetry(execute, {
      retries: Math.max(0, this.config.retryAttempts - 1),
      minTimeout: this.config.retryMinMs,
      maxTimeout: this.config.retryMaxMs
    });

    if (options.cache !== false) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  public async getAddress(address: string): Promise<JsonObject> {
    const path = `/v2/addresses/${checksumAddress(address)}`;
    return this.request(path, jsonObjectSchema);
  }

  public async getAddressTokenBalances(
    address: string,
    query?: Record<string, unknown>
  ): Promise<z.infer<typeof jsonObjectSchema> | z.infer<typeof jsonArraySchema>> {
    const path = `/v2/addresses/${checksumAddress(address)}/token-balances`;
    return this.request(path, z.union([jsonObjectSchema, jsonArraySchema]), { query });
  }

  public async getAddressCounters(address: string): Promise<JsonObject> {
    const path = `/v2/addresses/${checksumAddress(address)}/counters`;
    return this.request(path, jsonObjectSchema);
  }

  public async getAddressTransactions(
    address: string,
    query: Record<string, unknown>
  ): Promise<JsonObject> {
    const path = `/v2/addresses/${checksumAddress(address)}/transactions`;
    return this.request(path, jsonObjectSchema, { query, cache: false });
  }

  public async getAddressTokenTransfers(
    address: string,
    query: Record<string, unknown>
  ): Promise<z.infer<typeof jsonObjectSchema>> {
    const path = `/v2/addresses/${checksumAddress(address)}/token-transfers`;
    return this.request(path, jsonObjectSchema, { query, cache: false });
  }

  public async getTokenTransfers(
    address: string,
    query?: Record<string, unknown>
  ): Promise<z.infer<typeof jsonObjectSchema>> {
    const path = `/v2/tokens/${checksumAddress(address)}/transfers`;
    return this.request(path, jsonObjectSchema, { query, cache: false });
  }

  public async getTransaction(hash: string): Promise<JsonObject> {
    const path = `/v2/transactions/${hash}`;
    return this.request(path, jsonObjectSchema, { cache: false });
  }

  public async getContract(address: string): Promise<JsonObject> {
    const path = `/v2/smart-contracts/${checksumAddress(address)}`;
    return this.request(path, jsonObjectSchema);
  }

  public async getTransactionLogs(hash: string): Promise<JsonObject> {
    const path = `/v2/transactions/${hash}/logs`;
    return this.request(path, jsonObjectSchema, { cache: false });
  }

  public async getLogs(query: Record<string, unknown>): Promise<JsonObject> {
    return this.request('/v2/logs', jsonObjectSchema, { query, cache: false });
  }

  public async search(query: string): Promise<JsonObject> {
    return this.request('/v2/search', jsonObjectSchema, { query: { q: query } });
  }

  public async getToken(address: string): Promise<JsonObject> {
    const path = `/v2/tokens/${checksumAddress(address)}`;
    return this.request(path, jsonObjectSchema);
  }
}
