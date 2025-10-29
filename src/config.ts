import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const networkSchema = z.enum(['base-mainnet', 'base-sepolia']);

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().positive().default(7801),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  baseNetwork: networkSchema.default('base-mainnet'),
  blockscoutMainnetUrl: z.string().url(),
  blockscoutSepoliaUrl: z.string().url(),
  blockscoutApiKey: z.string().optional(),
  cacheTtlMs: z.coerce.number().int().nonnegative().default(15000),
  cacheMax: z.coerce.number().int().positive().default(500),
  ratePoints: z.coerce.number().int().positive().default(10),
  rateDurationSeconds: z.coerce.number().int().positive().default(1),
  retryAttempts: z.coerce.number().int().positive().default(3),
  retryMinMs: z.coerce.number().int().nonnegative().default(250),
  retryMaxMs: z.coerce.number().int().nonnegative().default(1500),
  routerConfigPath: z.string().optional()
});

export type AppConfig = z.infer<typeof configSchema> & {
  blockscoutBaseUrl: string;
};

export const loadConfig = (): AppConfig => {
  const parsed = configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    baseNetwork: process.env.BASE_NETWORK,
    blockscoutMainnetUrl: process.env.BLOCKSCOUT_MAINNET ?? 'https://base.blockscout.com/api',
    blockscoutSepoliaUrl:
      process.env.BLOCKSCOUT_SEPOLIA ?? 'https://base-sepolia.blockscout.com/api',
    blockscoutApiKey: process.env.BLOCKSCOUT_API_KEY,
    cacheTtlMs: process.env.CACHE_TTL_MS,
    cacheMax: process.env.CACHE_MAX,
    ratePoints: process.env.RATE_POINTS,
    rateDurationSeconds: process.env.RATE_DURATION_S,
    retryAttempts: process.env.RETRY_ATTEMPTS,
    retryMinMs: process.env.RETRY_MIN_MS,
    retryMaxMs: process.env.RETRY_MAX_MS,
    routerConfigPath: process.env.ROUTERS_CONFIG_PATH
  });

  const blockscoutBaseUrl =
    parsed.baseNetwork === 'base-sepolia' ? parsed.blockscoutSepoliaUrl : parsed.blockscoutMainnetUrl;

  return {
    ...parsed,
    blockscoutBaseUrl
  };
};
