import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  address: z.string().optional(),
  topics: z.array(z.string()).max(4).optional(),
  fromBlock: z.number().int().nonnegative().optional(),
  toBlock: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional()
});

const logSchema = z.object({
  address: z.string().optional(),
  data: z.string().optional(),
  topics: z.array(z.string()),
  blockNumber: z.number().optional(),
  transactionHash: z.string().optional(),
  logIndex: z.number().optional(),
  timestamp: z.number().optional()
});

const outputSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  nextPage: z.number().nullable(),
  items: z.array(logSchema)
});

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

export const getLogsTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getLogs',
  description: 'Retrieve contract logs filtered by address and topics.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address, topics, fromBlock, toBlock, page, pageSize }, { client }) => {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 100;

    const response = await client.getLogs({
      address,
      topics: topics?.join(','),
      from_block: fromBlock,
      to_block: toBlock,
      page: resolvedPage,
      page_size: resolvedPageSize
    });

    const items = ((response.items ?? response.result ?? []) as unknown[]).map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const topicsValue = Array.isArray(record.topics)
        ? record.topics.filter((topic): topic is string => typeof topic === 'string')
        : typeof record.topic === 'string'
          ? [record.topic]
          : [];

      return {
        address: typeof record.address === 'string' ? record.address : undefined,
        data: typeof record.data === 'string' ? record.data : undefined,
        topics: topicsValue,
        blockNumber: parseNumber(record.block_number),
        transactionHash:
          typeof record.transaction_hash === 'string'
            ? record.transaction_hash
            : typeof record.tx_hash === 'string'
              ? record.tx_hash
              : undefined,
        logIndex: parseNumber(record.log_index ?? record.index),
        timestamp: parseNumber(record.timestamp ?? record.block_timestamp)
      };
    });

    const filtered = items.filter((item): item is z.infer<typeof logSchema> => item !== null);

    const nextPageRaw = response.next_page ?? response.nextPage ?? null;
    const nextPage =
      typeof nextPageRaw === 'number'
        ? nextPageRaw
        : typeof nextPageRaw === 'string'
          ? Number(nextPageRaw)
          : null;

    return outputSchema.parse({
      page: resolvedPage,
      pageSize: resolvedPageSize,
      nextPage: Number.isFinite(nextPage) ? Number(nextPage) : null,
      items: filtered
    });
  }
};
