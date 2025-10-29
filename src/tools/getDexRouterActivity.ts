import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  router: z.string().min(1, 'Router address is required'),
  sinceMinutes: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional()
});

const decodedSchema = z
  .object({
    name: z.string().nullable(),
    signature: z.string().nullable(),
    params: z.array(z.record(z.unknown())).nullable()
  })
  .nullable();

const activitySchema = z.object({
  hash: z.string(),
  from: z.string().nullable(),
  method: z.string().nullable(),
  decoded: decodedSchema,
  timestamp: z.number().nullable(),
  value: z.string().nullable()
});

const outputSchema = z.object({
  router: z.string(),
  page: z.number(),
  pageSize: z.number(),
  sinceMinutes: z.number().nullable(),
  items: z.array(activitySchema)
});

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const getDexRouterActivityTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getDexRouterActivity',
  description: 'Inspect recent transactions sent to a known DEX router address.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ router, sinceMinutes, page, pageSize }, { client }) => {
    const resolvedPage = page ?? 1;
    const resolvedPageSize = pageSize ?? 20;
    const cutoffTimestamp =
      sinceMinutes !== undefined ? Date.now() - sinceMinutes * 60 * 1000 : undefined;

    const targetCount = resolvedPage * resolvedPageSize;
    const collected: unknown[] = [];
    let cursor: Record<string, unknown> | undefined;
    let exhausted = false;

    while (!exhausted && collected.length < targetCount) {
      const response = await client.getAddressTransactions(router, {
        filter: 'to',
        ...(cursor ?? {})
      });

      const batch = (response.items ?? response.result ?? []) as unknown[];
      collected.push(...batch);

      const nextCursor =
        response.next_page_params && typeof response.next_page_params === 'object'
          ? (response.next_page_params as Record<string, unknown>)
          : undefined;

      if (!nextCursor) {
        exhausted = true;
      } else {
        cursor = nextCursor;
      }

      if (!cutoffTimestamp) {
        continue;
      }

      const last = batch.at(-1);
      const lastTimestamp =
        last && typeof last === 'object'
          ? parseTimestamp(
              (last as Record<string, unknown>).timestamp ??
                (last as Record<string, unknown>).block_timestamp
            )
          : null;

      if (lastTimestamp && lastTimestamp < cutoffTimestamp) {
        exhausted = true;
      }
    }

    const items = collected
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const timestamp = parseTimestamp(record.timestamp ?? record.block_timestamp);

        if (cutoffTimestamp && timestamp) {
          const epochMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
          if (epochMs < cutoffTimestamp) {
            return null;
          }
        }

        const decodedSource =
          (record.decoded_input ??
            record.decoded ??
            record.method_details ??
            null) as Record<string, unknown> | null;

        const decoded =
          decodedSource && Object.keys(decodedSource).length > 0
            ? {
                name:
                  typeof decodedSource.name === 'string'
                    ? decodedSource.name
                    : typeof decodedSource.method_call === 'string'
                      ? decodedSource.method_call
                      : typeof decodedSource.method === 'string'
                        ? decodedSource.method
                        : null,
                signature:
                  typeof decodedSource.signature === 'string'
                    ? decodedSource.signature
                    : typeof decodedSource.method_id === 'string'
                      ? decodedSource.method_id
                      : typeof decodedSource.selector === 'string'
                        ? decodedSource.selector
                        : null,
                params: Array.isArray(decodedSource.params)
                  ? (decodedSource.params as Record<string, unknown>[])
                  : Array.isArray(decodedSource.parameters)
                    ? (decodedSource.parameters as Record<string, unknown>[])
                    : Array.isArray(decodedSource.arguments)
                      ? (decodedSource.arguments as Record<string, unknown>[])
                      : null
              }
            : null;

        const from =
          typeof record.from === 'string'
            ? record.from
            : record.from && typeof record.from === 'object' && typeof (record.from as Record<string, unknown>).hash === 'string'
              ? ((record.from as Record<string, unknown>).hash as string)
              : typeof record.sender === 'string'
                ? record.sender
                : null;

        const method =
          typeof record.method === 'string'
            ? record.method
            : typeof record.input_method === 'string'
              ? record.input_method
              : decoded?.name ?? null;

        return {
          hash: String(record.hash ?? record.tx_hash ?? ''),
          from,
          method,
          decoded,
          timestamp,
          value:
            typeof record.value === 'string'
              ? record.value
              : typeof record.amount === 'string'
                ? record.amount
                : null
        };
      })
      .filter((item): item is z.infer<typeof activitySchema> => {
        if (!item) {
          return false;
        }
        if (!cutoffTimestamp) {
          return true;
        }
        if (!item.timestamp) {
          return false;
        }
        return item.timestamp >= cutoffTimestamp;
      });

    const startIndex = (resolvedPage - 1) * resolvedPageSize;
    const pagedItems = items.slice(startIndex, startIndex + resolvedPageSize);

    return outputSchema.parse({
      router,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      sinceMinutes: sinceMinutes ?? null,
      items: pagedItems
    });
  }
};
