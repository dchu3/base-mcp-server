import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  direction: z.enum(['in', 'out', 'all']).optional()
});

const transactionSchema = z.object({
  hash: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  value: z.string().optional(),
  method: z.string().optional(),
  status: z.enum(['success', 'failed', 'pending']).optional(),
  timestamp: z.number().optional()
});

const outputSchema = z.object({
  address: z.string(),
  page: z.number(),
  pageSize: z.number(),
  nextPage: z.number().nullable(),
  items: z.array(transactionSchema)
});

type TransactionRecord = z.infer<typeof transactionSchema>;

const normalizeStatus = (value: unknown): TransactionRecord['status'] => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized.includes('success')) {
    return 'success';
  }
  if (normalized.includes('fail')) {
    return 'failed';
  }
  if (normalized.includes('pending')) {
    return 'pending';
  }
  return undefined;
};

const parseTimestamp = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const getTransactionsTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getTransactions',
  description: 'List recent transactions for an address with pagination.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address, page, pageSize, direction }, { client }) => {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 20;
    const filter =
      direction === 'in' ? 'incoming' : direction === 'out' ? 'outgoing' : direction === 'all' ? 'all' : undefined;

    const response = await client.getAddressTransactions(address, {
      page: resolvedPage,
      page_size: resolvedPageSize,
      filter
    });

    const items = ((response.items ?? response.result ?? []) as unknown[]).map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const tx: TransactionRecord = {
        hash: String(record.hash ?? record.tx_hash ?? ''),
        from: typeof record.from === 'string' ? record.from : undefined,
        to: typeof record.to === 'string' ? record.to : undefined,
        value: typeof record.value === 'string' ? record.value : undefined,
        method:
          typeof record.method === 'string'
            ? record.method
            : typeof record.call_type === 'string'
              ? record.call_type
              : undefined,
        status: normalizeStatus(record.status ?? record.result),
        timestamp: parseTimestamp(record.timestamp ?? record.block_timestamp ?? record.time)
      };

      return tx.hash ? tx : null;
    });

    const filteredItems = items.filter((tx): tx is TransactionRecord => tx !== null);

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
      items: filteredItems
    });
  }
};
