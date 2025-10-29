import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  hash: z.string().min(1, 'Transaction hash is required')
});

const logSchema = z.object({
  index: z.number().int().nonnegative().optional(),
  address: z.string().optional(),
  data: z.string().optional(),
  topics: z.array(z.string()).optional()
});

const outputSchema = z.object({
  hash: z.string(),
  blockNumber: z.number().nullable(),
  timestamp: z.number().nullable(),
  status: z.enum(['success', 'failed', 'pending']).nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  value: z.string().nullable(),
  fee: z.string().nullable(),
  method: z.string().nullable(),
  decodedMethod: z
    .object({
      signature: z.string().nullable(),
      name: z.string().nullable(),
      params: z.array(z.record(z.unknown())).nullable()
    })
    .nullable(),
  logs: z.array(logSchema)
});

type TransactionPayload = z.infer<typeof outputSchema>;

const normalizeStatus = (value: unknown): TransactionPayload['status'] => {
  if (typeof value !== 'string') {
    return null;
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
  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseLogs = (value: unknown): z.infer<typeof logSchema>[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      return {
        index:
          typeof record.index === 'number'
            ? record.index
            : typeof record.log_index === 'number'
              ? record.log_index
              : typeof record.index === 'string'
                ? Number(record.index)
                : undefined,
        address: typeof record.address === 'string' ? record.address : undefined,
        data: typeof record.data === 'string' ? record.data : undefined,
        topics: Array.isArray(record.topics)
          ? record.topics.filter((topic): topic is string => typeof topic === 'string')
          : undefined
      };
    })
    .filter((item): item is z.infer<typeof logSchema> => item !== null);
};

export const getTransactionByHashTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getTransactionByHash',
  description: 'Fetch a transaction by hash with decoded method information when available.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ hash }, { client }) => {
    const response = await client.getTransaction(hash);

    const decodedRaw = ((response.decoded_input ?? response.decoded) as Record<string, unknown> | undefined) ?? {};
    const logs = parseLogs(response.logs ?? response.log_events);

    const payload: TransactionPayload = {
      hash: String(response.hash ?? hash),
      blockNumber: toNullableNumber(response.block_number ?? response.block?.number),
      timestamp: toNullableNumber(response.timestamp ?? response.block_timestamp),
      status: normalizeStatus(response.status ?? response.tx_status ?? response.result),
      from: toNullableString(response.from),
      to: toNullableString(response.to),
      value: toNullableString(response.value),
      fee: toNullableString(response.fee ?? response.tx_fee),
      method: toNullableString(response.method ?? response.input_method),
      decodedMethod: (() => {
        if (!decodedRaw || Object.keys(decodedRaw).length === 0) {
          return null;
        }
        const signature = toNullableString(decodedRaw.signature ?? decodedRaw.selector);
        const name = toNullableString(decodedRaw.name);
        const params = Array.isArray(decodedRaw.params)
          ? (decodedRaw.params as Record<string, unknown>[])
          : Array.isArray(decodedRaw.arguments)
            ? (decodedRaw.arguments as Record<string, unknown>[])
            : null;

        return {
          signature,
          name,
          params
        };
      })(),
      logs
    };

    return outputSchema.parse(payload);
  }
};
