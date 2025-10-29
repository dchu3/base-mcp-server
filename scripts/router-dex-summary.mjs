import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const BLOCKSCOUT_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const CHAIN_ID = 'base';
const MAX_TOKENS = 5;

const startBlockscout = () =>
  new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js', 'start'],
    cwd: process.cwd(),
    env: {
      BASE_NETWORK: 'base-mainnet',
      PORT: '7801'
    },
    stderr: 'ignore'
  });

const startDexscreener = () =>
  new StdioClientTransport({
    command: 'node',
    args: ['/home/derekchudley/mcp-servers/mcp-dexscreener/index.js'],
    cwd: '/home/derekchudley/mcp-servers/mcp-dexscreener',
    stderr: 'ignore'
  });

const ensureClient = async (transport, name) => {
  const client = new McpClient({ name, version: '0.0.1' });
  await client.connect(transport);
  return client;
};

const extractAddresses = (items) => {
  const addresses = new Set();
  for (const item of items) {
    if (!item?.decoded?.params) continue;
    for (const param of item.decoded.params) {
      const value = param?.value;
      if (typeof value === 'string') {
        if (value.startsWith('0x') && value.length === 42) {
          addresses.add(value.toLowerCase());
        }
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry === 'string' && entry.startsWith('0x') && entry.length === 42) {
            addresses.add(entry.toLowerCase());
          }
        }
      }
    }
  }
  addresses.delete(BLOCKSCOUT_ROUTER.toLowerCase());
  addresses.delete('0x0000000000000000000000000000000000000000');
  return Array.from(addresses).slice(0, MAX_TOKENS);
};

const summarizePair = (pair) => {
  const { dexId, priceUsd, liquidity, txns, volume } = pair;
  return {
    dex: dexId,
    priceUsd: priceUsd ? Number(priceUsd) : null,
    liquidityUsd: liquidity?.usd ?? null,
    dailyVolumeUsd: volume?.h24 ?? null,
    hourlyBuys: txns?.h1?.buys ?? null,
    hourlySells: txns?.h1?.sells ?? null,
    url: pair.url
  };
};

const main = async () => {
  const blockscoutClient = await ensureClient(startBlockscout(), 'blockscout-script');
  const dexClient = await ensureClient(startDexscreener(), 'dexscreener-script');

  try {
    const routerResult = await blockscoutClient.callTool({
      name: 'getDexRouterActivity',
      arguments: {
        router: BLOCKSCOUT_ROUTER,
        page: 1,
        pageSize: 25
      }
    });

    if (routerResult.isError) {
      console.error('Blockscout tool failed:', routerResult);
      return;
    }

    const items = routerResult.structuredContent?.items ?? [];
    const uniqueAddresses = extractAddresses(items);
    const tokenSummaries = [];

    for (const address of uniqueAddresses) {
      const response = await dexClient.callTool({
        name: 'getTokenPools',
        arguments: {
          chainId: CHAIN_ID,
          tokenAddress: address
        }
      });

      if (response.isError) {
        tokenSummaries.push({ address, error: response.content?.[0]?.text ?? 'Dexscreener call failed' });
        continue;
      }

      const pools = JSON.parse(response.content?.[0]?.text ?? '[]');
      if (!Array.isArray(pools) || pools.length === 0) {
        tokenSummaries.push({ address, note: 'No pools returned' });
        continue;
      }

      const sortedPools = pools.slice().sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
      const topPool = sortedPools[0];
      tokenSummaries.push({
        address,
        symbol: topPool?.baseToken?.symbol ?? topPool?.quoteToken?.symbol ?? null,
        pairAddress: topPool?.pairAddress ?? null,
        summary: summarizePair(topPool)
      });
    }

    const summary = {
      router: BLOCKSCOUT_ROUTER,
      sampleSize: items.length,
      uniqueTokensExplored: uniqueAddresses.length,
      recentTransactions: items.slice(0, 5).map((item) => ({
        hash: item.hash,
        from: item.from,
        method: item.method,
        value: item.value,
        timestamp: item.timestamp
      })),
      dexInsights: tokenSummaries
    };

    console.log(JSON.stringify({
      blockscout: routerResult.structuredContent,
      dexSummary: summary
    }, null, 2));
  } finally {
    await blockscoutClient.close();
    await dexClient.close();
  }
};

await main();
