import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z, type AnyZodObject, type ZodRawShape, type ZodTypeAny } from 'zod';

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
  input: ZodTypeAny;
  output: ZodTypeAny;
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

const isZodObject = (schema: ZodTypeAny): schema is AnyZodObject => schema instanceof z.ZodObject;

const toShape = (schema: ZodTypeAny | undefined): ZodRawShape | undefined => {
  if (!schema || !isZodObject(schema)) {
    return undefined;
  }
  return schema.shape as ZodRawShape;
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

export const createServer = ({ config, client, routers }: ServerOptions): ServerTransport => {
  const mergedRouters = routers ?? DEFAULT_ROUTERS;
  const toolset = buildToolset(client, mergedRouters);
  const instructions = `${SERVER_PROMPT}\n\nNetwork: ${config.baseNetwork}`;

  const server = new McpServer(
    {
      name: 'base-mcp-server',
      version: '0.1.0'
    },
    {
      instructions
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
      async (args: unknown) => {
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
