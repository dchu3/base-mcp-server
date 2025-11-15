import { z } from 'zod';

import type { ToolDefinition } from './types.js';
import { formatWeiToEther } from '../utils.js';

const inputSchema = z.object({
  address: z.string().min(1, 'Address is required')
});

const tokenSchema = z.object({
  address: z.string().optional(),
  symbol: z.string().optional(),
  name: z.string().optional(),
  balance: z.string().optional(),
  decimals: z.number().optional(),
  usdValue: z.number().optional()
});

const outputSchema = z.object({
  address: z.string(),
  balance: z.object({
    wei: z.string(),
    ether: z.string()
  }),
  transactionCount: z.number(),
  nonce: z.number().nullable(),
  tokenBalances: z.array(tokenSchema)
});

type AccountSummaryOutput = z.infer<typeof outputSchema>;

const parseTransactionCount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseNonce = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractTokens = (raw: unknown): AccountSummaryOutput['tokenBalances'] => {
  if (!raw) {
    return [];
  }

  const items = Array.isArray(raw)
    ? raw
    : ((raw as Record<string, unknown>).items ??
        (raw as Record<string, unknown>).result ??
        (raw as Record<string, unknown>).data ??
        []) as unknown[];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const token = (record.token ??
        record.contract ??
        record.details ??
        {}) as Record<string, unknown>;

      const balance =
        (record.balance ?? record.value ?? record.amount) && String(record.balance ?? record.value ?? record.amount);
      const usdValueRaw = record.usd_value ?? record.usdPrice ?? record.usd;
      const usdValue =
        typeof usdValueRaw === 'number'
          ? usdValueRaw
          : typeof usdValueRaw === 'string'
            ? Number(usdValueRaw)
            : undefined;

      return {
        address: typeof token.address === 'string' ? token.address : undefined,
        symbol: typeof token.symbol === 'string' ? token.symbol : undefined,
        name: typeof token.name === 'string' ? token.name : undefined,
        balance: typeof balance === 'string' ? balance : undefined,
        decimals:
          typeof token.decimals === 'number'
            ? token.decimals
            : typeof token.decimals === 'string'
              ? Number(token.decimals)
              : undefined,
        usdValue: usdValue && Number.isFinite(usdValue) ? usdValue : undefined
      };
    })
    .filter((token): token is z.infer<typeof tokenSchema> => token !== null)
    .slice(0, 20);
};

export const getAccountSummaryTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getAccountSummary',
  description: 'Fetch ETH balance, nonce, transaction count, and top token balances for an address.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address }, { client }) => {
    const [accountRaw, tokensRaw, countersRaw] = await Promise.all([
      client.getAddress(address),
      client.getAddressTokenBalances(address),
      client.getAddressCounters(address)
    ]);

    const normalizedAddress =
      (accountRaw.hash as string | undefined) ??
      (accountRaw.address as string | undefined) ??
      address.toLowerCase();

    const balanceWei =
      (accountRaw.balance as string | undefined) ??
      (accountRaw.coin_balance as string | undefined) ??
      (accountRaw.value as string | undefined) ??
      '0';

    const transactionCount =
      parseTransactionCount(
        (countersRaw.transactions_count as string | number | undefined) ??
          (countersRaw.tx_count as string | number | undefined)
      ) ??
      parseTransactionCount(accountRaw.tx_count) ??
      parseTransactionCount(accountRaw.transaction_count) ??
      parseTransactionCount(accountRaw.transactions_count);

    const nonce = parseNonce(accountRaw.nonce);

    const tokenBalances = extractTokens(tokensRaw);

    const result: AccountSummaryOutput = {
      address: normalizedAddress,
      balance: {
        wei: balanceWei,
        ether: formatWeiToEther(balanceWei)
      },
      transactionCount,
      nonce,
      tokenBalances
    };

    return outputSchema.parse(result);
  }
};
