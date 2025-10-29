import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { BlockscoutClient } from './blockscout.js';
import type { AppConfig } from './config.js';
import { DEFAULT_ROUTERS, mergeRouters, type RouterMap, selectRoutersForNetwork } from './routers.js';
import { SERVER_PROMPT } from './prompt.js';
import { tools } from './tools/index.js';

export interface ServerOptions {
  config: AppConfig;
  client: BlockscoutClient;
  routers?: RouterMap;
}

export interface ServerTransport {
  start: () => Promise<void>;
}

export interface BuiltTool {
  name: string;
  description: string;
  input: z.ZodObject<any>;
  output: z.ZodObject<any>;
  execute: (args: unknown) => Promise<unknown>;
}

export const buildToolset = (client: BlockscoutClient, routers: RouterMap): BuiltTool[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
    output: tool.output,
    execute: async (args: unknown) => tool.execute(tool.input.parse(args), { client, routers })
  }));

const toShape = (schema: z.ZodTypeAny | undefined) => {
  if (!schema) {
    return undefined;
  }
  return schema instanceof z.ZodObject ? schema.shape : undefined;
};

const toCallToolResult = (result: unknown): CallToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }
  ],
  structuredContent: result
});

export const createServer = async ({ config, client, routers }: ServerOptions): Promise<ServerTransport> => {
  const mergedRouters = routers ?? DEFAULT_ROUTERS;
  const toolset = buildToolset(client, mergedRouters);

  const server = new McpServer(
    {
      name: 'base-mcp-server',
      version: '0.1.0'
    },
    {
      instructions: SERVER_PROMPT
    }
  );

  for (const tool of toolset) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: toShape(tool.input),
        outputSchema: toShape(tool.output)
      },
      async (args) => {
        try {
          const result = await tool.execute(args);
          return toCallToolResult(result);
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : 'Tool execution failed'
              }
            ],
            isError: true
          };
        }
      }
    );
  }

  return {
    start: async () => {
      const transport = new StdioServerTransport();
      await server.connect(transport);
    }
  };
};

export const createRouterPrinter = (config: AppConfig, overrides?: RouterMap) => {
  const merged = mergeRouters(DEFAULT_ROUTERS, overrides);
  const routers = selectRoutersForNetwork(merged, config.baseNetwork);
  return (): void => {
    for (const [name, address] of Object.entries(routers)) {
      // eslint-disable-next-line no-console
      console.log(`${name}: ${address}`);
    }
  };
};
