import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  query: z.string().min(2, 'Search term must be at least two characters')
});

const searchResultSchema = z.object({
  type: z.string(),
  name: z.string().nullable(),
  hash: z.string().nullable(),
  address: z.string().nullable(),
  label: z.string().nullable(),
  match: z.string().nullable()
});

const outputSchema = z.object({
  query: z.string(),
  items: z.array(searchResultSchema)
});

export const searchTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'search',
  description: 'Search for addresses, tokens, or transactions on Blockscout.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ query }, { client }) => {
    const response = await client.search(query);
    const results = ((response.items ?? response.result ?? []) as unknown[]).slice(0, 10);

    const items = results
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        return {
          type: typeof record.type === 'string' ? record.type : 'unknown',
          name:
            typeof record.name === 'string'
              ? record.name
              : typeof record.title === 'string'
                ? record.title
                : null,
          hash:
            typeof record.hash === 'string'
              ? record.hash
              : typeof record.tx_hash === 'string'
                ? record.tx_hash
                : null,
          address:
            typeof record.address === 'string'
              ? record.address
              : typeof record.contract_address === 'string'
                ? record.contract_address
                : null,
          label: typeof record.label === 'string' ? record.label : null,
          match:
            typeof record.match === 'string'
              ? record.match
              : typeof record.matched_text === 'string'
                ? record.matched_text
                : null
        };
      })
      .filter((item): item is z.infer<typeof searchResultSchema> => item !== null);

    return outputSchema.parse({
      query,
      items
    });
  }
};
