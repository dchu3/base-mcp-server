import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  address: z.string().min(1, 'Token address is required')
});

const outputSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  decimals: z.number().nullable(),
  totalSupply: z.string().nullable(),
  holders: z.number().nullable(),
  type: z.string().nullable()
});

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const resolveTokenTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'resolveToken',
  description: 'Look up metadata for a token contract.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address }, { client }) => {
    const response = await client.getToken(address);

    return outputSchema.parse({
      address,
      name:
        typeof response.name === 'string'
          ? response.name
          : typeof response.token_name === 'string'
            ? response.token_name
            : null,
      symbol:
        typeof response.symbol === 'string'
          ? response.symbol
          : typeof response.token_symbol === 'string'
            ? response.token_symbol
            : null,
      decimals: (() => {
        if (typeof response.decimals === 'number') {
          return response.decimals;
        }
        const decimalsString =
          typeof response.decimals === 'string'
            ? response.decimals
            : typeof response.token_decimals === 'string'
              ? response.token_decimals
              : null;

        if (decimalsString) {
          const parsed = Number(decimalsString);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })(),
      totalSupply:
        typeof response.total_supply === 'string'
          ? response.total_supply
          : typeof response.supply === 'string'
            ? response.supply
            : null,
      holders: parseNumber(response.holders ?? response.holder_count),
      type:
        typeof response.type === 'string'
          ? response.type
          : typeof response.token_type === 'string'
            ? response.token_type
            : null
    });
  }
};
