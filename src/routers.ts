import { promises as fs } from 'node:fs';
import { z } from 'zod';

const routerSchema = z.object({
  mainnet: z.string().min(1),
  sepolia: z.string().min(1)
});

const routersSchema = z.record(routerSchema);

export type RouterMap = z.infer<typeof routersSchema>;

export const DEFAULT_ROUTERS: RouterMap = {
  uniswap_v3: {
    mainnet: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sepolia: '0x0000000000000000000000000000000000000000'
  },
  aerodrome_v2: {
    mainnet: '0xC5cf4D1AA5CfaF47010AC094d2Eac45B42C4B9c4',
    sepolia: '0x0000000000000000000000000000000000000000'
  },
  pancakeswap_v3: {
    mainnet: '0x6DD655f4dF4A2E80bA1a95B2c98b1EB2D646b2A2',
    sepolia: '0x0000000000000000000000000000000000000000'
  }
};

export const selectRoutersForNetwork = (
  routers: RouterMap,
  network: 'base-mainnet' | 'base-sepolia'
): Record<string, string> =>
  Object.entries(routers).reduce<Record<string, string>>((acc, [name, addresses]) => {
    acc[name] = network === 'base-sepolia' ? addresses.sepolia : addresses.mainnet;
    return acc;
  }, {});

export const validateRouterConfig = (value: unknown): RouterMap => routersSchema.parse(value);

export const mergeRouters = (base: RouterMap, overrides?: RouterMap): RouterMap => {
  if (!overrides) {
    return base;
  }

  const merged: RouterMap = { ...base };
  for (const [name, addresses] of Object.entries(overrides)) {
    merged[name] = {
      mainnet: addresses.mainnet ?? base[name]?.mainnet ?? '',
      sepolia: addresses.sepolia ?? base[name]?.sepolia ?? ''
    };
  }
  return merged;
};

export const loadRouterOverrides = async (path: string): Promise<RouterMap | undefined> => {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return validateRouterConfig(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

export const saveRouterOverrides = async (path: string, routers: RouterMap): Promise<void> => {
  const json = JSON.stringify(routers, null, 2);
  await fs.writeFile(path, `${json}\n`, 'utf8');
};
