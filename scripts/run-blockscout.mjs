import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js', 'start'],
  cwd: process.cwd(),
  env: {
    BASE_NETWORK: 'base-mainnet',
    PORT: '7801'
  },
  stderr: 'pipe'
});

if (transport.stderr) {
  transport.stderr.on('data', (chunk) => {
    process.stderr.write(`[server] ${chunk}`);
  });
}

const client = new Client({
  name: 'script',
  version: '0.0.1'
});

await client.connect(transport);

const params = {
  name: 'getDexRouterActivity',
  arguments: {
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    page: 1,
    pageSize: 25
  }
};

const result = await client.callTool(params);

console.log(JSON.stringify(result, null, 2));

await client.close();
