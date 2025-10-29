import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional()
});

const transferSchema = z.object({
  hash: z.string(),
  logIndex: z.number().int().nonnegative().optional(),
  blockNumber: z.number().int().nonnegative().optional(),
  timestamp: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  token: z.object({
    address: z.string().optional(),
    symbol: z.string().optional(),
    name: z.string().optional(),
    decimals: z.number().optional()
  }),
  amount: z.string().optional(),
  type: z.string().optional()
});

const outputSchema = z.object({
  address: z.string(),
  page: z.number(),
  pageSize: z.number(),
  nextPage: z.number().nullable(),
  items: z.array(transferSchema)
});

type TransferRecord = z.infer<typeof transferSchema>;

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const getTokenTransfersTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getTokenTransfers',
  description: 'List token transfer events involving the given address.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address, page, pageSize }, { client }) => {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 20;

    const response = await client.getAddressTokenTransfers(address, {
      page: resolvedPage,
      page_size: resolvedPageSize
    });

    const itemsRaw = (response.items ?? response.result ?? []) as unknown[];
    const items = itemsRaw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const token =
          (record.token ?? record.contract ?? record.token_contract ?? {}) as Record<string, unknown>;

        const decimalsRaw = token.decimals ?? token.decimal ?? record.token_decimals;
        const decimals =
          typeof decimalsRaw === 'number'
            ? decimalsRaw
            : typeof decimalsRaw === 'string'
              ? Number(decimalsRaw)
              : undefined;

        const transfer: TransferRecord = {
          hash: String(record.tx_hash ?? record.transaction_hash ?? ''),
          logIndex: parseNumber(record.log_index ?? record.index),
          blockNumber: parseNumber(record.block_number),
          timestamp: parseNumber(record.timestamp ?? record.block_timestamp),
          from: typeof record.from === 'string' ? record.from : undefined,
          to: typeof record.to === 'string' ? record.to : undefined,
          token: {
            address: typeof token.address === 'string' ? token.address : undefined,
            symbol: typeof token.symbol === 'string' ? token.symbol : undefined,
            name: typeof token.name === 'string' ? token.name : undefined,
            decimals: Number.isFinite(decimals) ? Number(decimals) : undefined
          },
          amount: typeof record.amount === 'string' ? record.amount : typeof record.value === 'string' ? record.value : undefined,
          type: typeof record.type === 'string' ? record.type : undefined
        };

        return transfer.hash ? transfer : null;
      })
      .filter((transfer): transfer is TransferRecord => transfer !== null);

    const nextPageRaw = response.next_page ?? response.nextPage ?? null;
    const nextPage =
      typeof nextPageRaw === 'number'
        ? nextPageRaw
        : typeof nextPageRaw === 'string'
          ? Number(nextPageRaw)
          : null;

    return outputSchema.parse({
      address,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      nextPage: Number.isFinite(nextPage) ? Number(nextPage) : null,
      items
    });
  }
};
