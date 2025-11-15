import http from 'node:http';

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

import { BlockscoutClient } from './blockscout.js';
import { loadConfig, type AppConfig } from './config.js';
import { createRateLimiter } from './rate.js';
import { createRouterPrinter, createServer } from './server.js';
import {
  DEFAULT_ROUTERS,
  type RouterMap,
  loadRouterOverrides,
  mergeRouters,
  saveRouterOverrides,
  selectRoutersForNetwork,
  validateRouterConfig
} from './routers.js';

type NetworkName = 'base-mainnet' | 'base-sepolia';
type RouterAction = 'print' | 'get' | 'set';

const isNetworkName = (value: unknown): value is NetworkName =>
  value === 'base-mainnet' || value === 'base-sepolia';

const parseNetworkArg = (value: unknown): NetworkName | undefined =>
  typeof value === 'string' && isNetworkName(value) ? value : undefined;

const assertRouterAction = (value: unknown): RouterAction => {
  if (value === 'print' || value === 'get' || value === 'set') {
    return value;
  }
  throw new Error('Unsupported router action');
};

const applyOverrides = (
  config: AppConfig,
  overrides: {
    port?: number;
    network?: NetworkName;
    logLevel?: AppConfig['logLevel'];
  }
): AppConfig => ({
  ...config,
  port: overrides.port ?? config.port,
  baseNetwork: overrides.network ?? config.baseNetwork,
  logLevel: overrides.logLevel ?? config.logLevel
});

const LOG_LEVELS: readonly AppConfig['logLevel'][] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent'
] as const;

const toLogLevel = (value: unknown): AppConfig['logLevel'] | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  return LOG_LEVELS.includes(value as AppConfig['logLevel'])
    ? (value as AppConfig['logLevel'])
    : undefined;
};

const startHealthServer = (port: number, network: string): http.Server => {
  const server = http.createServer((req, res) => {
    if (req.url !== '/healthz') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        network,
        timestamp: Date.now()
      })
    );
  });

  server.listen(port, () => {
    // eslint-disable-next-line no-console -- log to stderr to avoid polluting MCP stdio
    console.error(`Health endpoint listening on http://localhost:${port}/healthz`);
  });

  return server;
};

const loadRouters = async (
  config: AppConfig
): Promise<{
  overrides?: RouterMap;
  merged: RouterMap;
  resolved: Record<string, string>;
}> => {
  const overrides = config.routerConfigPath
    ? await loadRouterOverrides(config.routerConfigPath)
    : undefined;
  const merged = mergeRouters(DEFAULT_ROUTERS, overrides);
  return {
    overrides,
    merged,
    resolved: selectRoutersForNetwork(merged, config.baseNetwork)
  };
};

const startCommand = async (argv: {
  port?: number;
  network?: NetworkName;
  logLevel?: AppConfig['logLevel'];
}): Promise<void> => {
  const baseConfig = loadConfig();
  const config = applyOverrides(baseConfig, argv);
  const { merged } = await loadRouters(config);

  const rateLimiter = createRateLimiter({
    points: config.ratePoints,
    duration: config.rateDurationSeconds
  });

  const client = new BlockscoutClient(config, rateLimiter);
  const server = createServer({ config, client, routers: merged });

  const health = startHealthServer(config.port, config.baseNetwork);

  try {
    await server.start();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start MCP server:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    health.close();
  }
};

const healthCommand = async (): Promise<void> => {
  const config = loadConfig();
  const rateLimiter = createRateLimiter({
    points: config.ratePoints,
    duration: config.rateDurationSeconds
  });
  const client = new BlockscoutClient(config, rateLimiter);

  try {
    await client.search('base');
    // eslint-disable-next-line no-console
    console.log('Blockscout reachable');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Health check failed:', (error as Error).message);
    process.exitCode = 1;
  }
};

const routersCommand = async (argv: {
  action: RouterAction;
  name?: string;
  network?: NetworkName;
  address?: string;
}): Promise<void> => {
  const config = loadConfig();
  const { overrides, merged, resolved } = await loadRouters(config);

  if (argv.action === 'print') {
    createRouterPrinter(config, overrides)();
    return;
  }

  if (argv.action === 'get') {
    if (!argv.name) {
      throw new Error('Router name is required for get action.');
    }
    const key = argv.name;
    const mapped = resolved[key];
    if (!mapped) {
      // eslint-disable-next-line no-console
      console.error(`Router ${key} not found in current configuration.`);
      process.exitCode = 1;
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`${key}: ${mapped}`);
    return;
  }

  if (!config.routerConfigPath) {
    throw new Error('ROUTERS_CONFIG_PATH must be set to use the set action.');
  }

  if (!argv.name || !argv.network || !argv.address) {
    throw new Error('Set action requires name, network, and address.');
  }

  const currentOverrides = overrides ?? {};
  const currentBase: RouterMap[string] = merged[argv.name] ?? {
    mainnet: argv.address,
    sepolia: argv.address
  };
  const current = currentOverrides[argv.name] ?? currentBase;

  const updated = {
    ...currentOverrides,
    [argv.name]: {
      mainnet: argv.network === 'base-mainnet' ? argv.address : current.mainnet,
      sepolia: argv.network === 'base-sepolia' ? argv.address : current.sepolia
    }
  };

  const validated = validateRouterConfig(updated);
  await saveRouterOverrides(config.routerConfigPath, validated);
  // eslint-disable-next-line no-console
  console.log(`Updated router ${argv.name} for ${argv.network}.`);
};

void yargs(hideBin(process.argv))
  .scriptName('base-mcp-server')
  .command(
    'start',
    'Start the Base Blockscout MCP server',
    (y) =>
      y
        .option('port', {
          type: 'number',
          describe: 'Port for HTTP health endpoint',
          default: undefined
        })
        .option('network', {
          type: 'string',
          choices: ['base-mainnet', 'base-sepolia'] as const,
          describe: 'Select Blockscout network'
        })
        .option('log-level', {
          type: 'string',
          describe: 'Set log level'
        }),
    (args) => {
      void startCommand({
        port: args.port,
        network: parseNetworkArg(args.network),
        logLevel: toLogLevel(args.logLevel)
      });
    }
  )
  .command('health', 'Probe Blockscout availability', () => {
    void healthCommand();
  })
  .command(
    'routers <action>',
    'Manage known router addresses',
    (y) =>
      y
        .positional('action', {
          type: 'string',
          choices: ['print', 'get', 'set'] as const
        })
        .option('name', {
          type: 'string',
          describe: 'Router identifier for get/set'
        })
        .option('network', {
          type: 'string',
          choices: ['base-mainnet', 'base-sepolia'] as const,
          describe: 'Network when setting an address'
        })
        .option('address', {
          type: 'string',
          describe: 'Router address when setting'
        }),
    (args) => {
      void routersCommand({
        action: assertRouterAction(args.action),
        name: args.name,
        network: parseNetworkArg(args.network),
        address: args.address
      });
    }
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();
