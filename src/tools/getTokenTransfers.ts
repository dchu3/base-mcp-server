import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const cursorSchema = z.object({
  blockNumber: z.number().int().nonnegative(),
  index: z.number().int().nonnegative()
});

const inputSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  cursor: cursorSchema.optional()
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
  cursor: cursorSchema.nullable(),
  nextCursor: cursorSchema.nullable(),
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

const parseTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return undefined;
};

export const getTokenTransfersTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getTokenTransfers',
  description: 'List token transfer events involving the given address.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address, cursor }, { client }) => {
    const query =
      cursor !== undefined
        ? {
            block_number: cursor.blockNumber,
            index: cursor.index
          }
        : undefined;

    const response = await client.getTokenTransfers(address, query);

    const itemsRaw = (response.items ?? response.result ?? []) as unknown[];
    const items = itemsRaw
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const record = item as Record<string, unknown>;
        const token = (record.token ?? record.contract ?? record.token_contract ?? {}) as Record<
          string,
          unknown
        >;
        const total = (record.total ?? {}) as Record<string, unknown>;
        const from = (record.from ?? {}) as Record<string, unknown>;
        const to = (record.to ?? {}) as Record<string, unknown>;

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
          timestamp: parseTimestamp(record.timestamp ?? record.block_timestamp),
          from:
            typeof record.from === 'string'
              ? record.from
              : typeof from.hash === 'string'
                ? from.hash
                : undefined,
          to:
            typeof record.to === 'string'
              ? record.to
              : typeof to.hash === 'string'
                ? to.hash
                : undefined,
          token: {
            address:
              typeof token.address === 'string'
                ? token.address
                : typeof token.address_hash === 'string'
                  ? token.address_hash
                  : undefined,
            symbol: typeof token.symbol === 'string' ? token.symbol : undefined,
            name: typeof token.name === 'string' ? token.name : undefined,
            decimals: Number.isFinite(decimals) ? Number(decimals) : undefined
          },
          amount:
            typeof record.amount === 'string'
              ? record.amount
              : typeof record.value === 'string'
                ? record.value
                : typeof total.value === 'string'
                  ? total.value
                  : undefined,
          type:
            typeof record.type === 'string'
              ? record.type
              : typeof record.token_type === 'string'
                ? record.token_type
                : undefined
        };

        return transfer.hash ? transfer : null;
      })
      .filter((transfer): transfer is TransferRecord => transfer !== null);

    const nextPageRaw =
      (response.next_page_params ?? response.next_page ?? response.nextPage ?? null) as
        | Record<string, unknown>
        | null;
    const nextCursor =
      nextPageRaw && typeof nextPageRaw === 'object'
        ? {
            blockNumber: parseNumber(nextPageRaw.block_number) ?? null,
            index: parseNumber(nextPageRaw.index) ?? null
          }
        : null;

    const normalizedNextCursor =
      nextCursor && Number.isFinite(nextCursor.blockNumber) && Number.isFinite(nextCursor.index)
        ? {
            blockNumber: Number(nextCursor.blockNumber),
            index: Number(nextCursor.index)
          }
        : null;

    return outputSchema.parse({
      address,
      cursor: cursor ?? null,
      nextCursor: normalizedNextCursor,
      items
    });
  }
};
