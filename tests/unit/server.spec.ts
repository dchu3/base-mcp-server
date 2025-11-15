import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { SERVER_PROMPT } from '../../src/prompt.js';
import { createServer } from '../../src/server.js';

const registerToolMock = vi.fn();
const connectMock = vi.fn();
const constructorMock = vi.fn();

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class MockMcpServer {
    constructor(...args: unknown[]) {
      constructorMock(...args);
    }

    registerTool = registerToolMock;

    connect = connectMock;
  }

  return { McpServer: MockMcpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../src/tools/index.js', () => {
  const tool = {
    name: 'mockTool',
    description: 'Mock tool',
    input: z.object({}),
    output: z.object({}),
    execute: () => Promise.resolve({ ok: true })
  };
  return { tools: [tool] };
});

describe('createServer', () => {
  beforeEach(() => {
    registerToolMock.mockClear();
    connectMock.mockClear();
    constructorMock.mockClear();
  });

  it('passes the server prompt to the MCP metadata', () => {
    const config = {
      nodeEnv: 'test',
      port: 1234,
      logLevel: 'info' as const,
      baseNetwork: 'base-mainnet' as const,
      blockscoutMainnetUrl: 'https://example.com',
      blockscoutSepoliaUrl: 'https://example.com',
      blockscoutApiKey: undefined,
      cacheTtlMs: 0,
      cacheMax: 1,
      ratePoints: 1,
      rateDurationSeconds: 1,
      retryAttempts: 1,
      retryMinMs: 0,
      retryMaxMs: 0,
      routerConfigPath: undefined,
      blockscoutBaseUrl: 'https://example.com'
    };

    createServer({
      config,
      client: {} as never,
      routers: {}
    });

    expect(constructorMock).toHaveBeenCalledWith(
      {
        name: 'base-mcp-server',
        version: '0.1.0'
      },
      expect.objectContaining({
        instructions: `${SERVER_PROMPT}\n\nNetwork: ${config.baseNetwork}`
      })
    );
  });
});
