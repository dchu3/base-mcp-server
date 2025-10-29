import { z } from 'zod';

import type { ToolDefinition } from './types.js';

const inputSchema = z.object({
  address: z.string().min(1, 'Contract address is required')
});

const outputSchema = z.object({
  address: z.string(),
  abi: z.array(z.record(z.unknown())).optional(),
  metadata: z.object({
    compiler: z.string().nullable(),
    evmVersion: z.string().nullable(),
    verifiedAt: z.string().nullable(),
    verified: z.boolean()
  })
});

export const getContractABITool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'getContractABI',
  description: 'Fetch the verified ABI and metadata for a smart contract.',
  input: inputSchema,
  output: outputSchema,
  execute: async ({ address }, { client }) => {
    const response = await client.getContract(address);
    const abiRaw = response.abi ?? response.result ?? response.abi_json;

    const abi = (() => {
      if (typeof abiRaw === 'string') {
        try {
          return JSON.parse(abiRaw) as z.infer<typeof outputSchema>['abi'];
        } catch {
          return undefined;
        }
      }
      if (Array.isArray(abiRaw)) {
        return abiRaw as z.infer<typeof outputSchema>['abi'];
      }
      return undefined;
    })();

    const metadata = {
      compiler:
        typeof response.compiler === 'string'
          ? response.compiler
          : typeof response.compiler_version === 'string'
            ? response.compiler_version
            : null,
      evmVersion:
        typeof response.evm === 'string'
          ? response.evm
          : typeof response.evm_version === 'string'
            ? response.evm_version
            : null,
      verifiedAt:
        typeof response.verified_at === 'string'
          ? response.verified_at
          : typeof response.verification_date === 'string'
            ? response.verification_date
            : null,
      verified: Boolean(response.verified ?? response.is_verified ?? abi)
    };

    return outputSchema.parse({
      address,
      abi,
      metadata
    });
  }
};
