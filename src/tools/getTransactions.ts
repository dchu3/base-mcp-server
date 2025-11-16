import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const cursorValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const cursorSchema = z.record(cursorValueSchema);

const inputSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  direction: z.enum(['in', 'out', 'all']).optional(),
  cursor: cursorSchema.optional()
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
  cursor: cursorSchema.nullable(),
  nextCursor: cursorSchema.nullable(),
  items: z.array(transactionSchema)
});

type TransactionRecord = z.infer<typeof transactionSchema>;
type CursorRecord = z.infer<typeof cursorSchema>;

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

const parseCursor = (value: unknown): CursorRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).reduce<Record<string, z.infer<typeof cursorValueSchema>>>(
    (acc, [key, raw]) => {
      if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean'
      ) {
        acc[key] = raw;
      }
      return acc;
    },
    {}
  );

  return Object.keys(entries).length > 0 ? entries : null;
};

export const getTransactionsTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getTransactions',
  description: 'List recent transactions for an address with pagination.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address, direction, cursor }, { client }) => {
    const filter = direction === 'in' ? 'to' : direction === 'out' ? 'from' : undefined;
    const query: Record<string, unknown> = cursor ? { ...cursor } : {};
    if (filter && query.filter === undefined) {
      query.filter = filter;
    }

    const response = await client.getAddressTransactions(address, query);

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

    const nextCursor =
      parseCursor(response.next_page_params) ??
      parseCursor(typeof response.next_page === 'object' ? response.next_page : null) ??
      parseCursor(typeof response.nextPage === 'object' ? response.nextPage : null);

    return outputSchema.parse({
      address,
      cursor: cursor ?? null,
      nextCursor,
      items: filteredItems
    });
  }
};
