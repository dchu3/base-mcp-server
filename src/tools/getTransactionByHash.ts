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
  result: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  value: z.string().nullable(),
  fee: z.string().nullable(),
  gasUsed: z.string().nullable(),
  gasLimit: z.string().nullable(),
  gasPrice: z.string().nullable(),
  maxFeePerGas: z.string().nullable(),
  maxPriorityFeePerGas: z.string().nullable(),
  priorityFee: z.string().nullable(),
  transactionBurntFee: z.string().nullable(),
  l1GasUsed: z.string().nullable(),
  l1GasPrice: z.string().nullable(),
  l1Fee: z.string().nullable(),
  l1FeeScalar: z.string().nullable(),
  nonce: z.number().nullable(),
  confirmations: z.number().nullable(),
  position: z.number().nullable(),
  type: z.number().nullable(),
  transactionTag: z.string().nullable(),
  isPendingUpdate: z.boolean().nullable(),
  method: z.string().nullable(),
  rawInput: z.string().nullable(),
  transactionTypes: z.array(z.string()).nullable(),
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
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return null;
};

const toNullableBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return null;
};

const extractAddress = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.hash === 'string') {
      return record.hash;
    }
  }
  return null;
};

const extractFeeValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.value === 'string') {
      return record.value;
    }
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
      result: toNullableString(response.result ?? response.status ?? response.tx_status),
      from: extractAddress(response.from),
      to: extractAddress(response.to),
      value: toNullableString(response.value),
      fee: extractFeeValue(response.fee) ?? toNullableString(response.tx_fee),
      gasUsed: toNullableString(response.gas_used),
      gasLimit: toNullableString(response.gas_limit),
      gasPrice: toNullableString(response.gas_price),
      maxFeePerGas: toNullableString(response.max_fee_per_gas),
      maxPriorityFeePerGas: toNullableString(response.max_priority_fee_per_gas),
      priorityFee: toNullableString(response.priority_fee),
      transactionBurntFee: toNullableString(response.transaction_burnt_fee),
      l1GasUsed: toNullableString(response.l1_gas_used),
      l1GasPrice: toNullableString(response.l1_gas_price),
      l1Fee: toNullableString(response.l1_fee),
      l1FeeScalar: toNullableString(response.l1_fee_scalar),
      nonce: toNullableNumber(response.nonce),
      confirmations: toNullableNumber(response.confirmations),
      position: toNullableNumber(response.position),
      type: toNullableNumber(response.type),
      transactionTag: toNullableString(response.transaction_tag),
      isPendingUpdate: toNullableBoolean(response.is_pending_update),
      method: toNullableString(response.method ?? response.input_method),
      rawInput: toNullableString(response.raw_input ?? response.input),
      transactionTypes: Array.isArray(response.transaction_types)
        ? response.transaction_types.filter((entry): entry is string => typeof entry === 'string')
        : null,
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
