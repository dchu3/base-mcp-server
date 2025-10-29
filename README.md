# base-mcp-server

MCP server for Base that wraps the Blockscout API into agent-friendly tools. It exposes
account, transaction, contract, token, log, and router activity queries for both Base
Mainnet and Base Sepolia.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Set `BASE_NETWORK` to `base-mainnet` or `base-sepolia` in `.env`. Override Blockscout
endpoints or router config through environment variables when needed.

## Key Commands

- `npm run dev` – start the MCP server in watch mode (stdio transport).
- `npm run build` – bundle the project with tsup.
- `npm run start` – run the compiled server from `dist/`.
- `npm run test` – execute Vitest unit tests.
- `npm run lint` – lint the TypeScript sources.
- `npm run format` – format the codebase via Prettier.

## CLI Interface

```bash
# Start the MCP server (reads .env)
base-mcp-server start --network base-mainnet

# Print known router addresses for the active network
base-mcp-server routers print

# Update a router override (requires ROUTERS_CONFIG_PATH)
base-mcp-server routers set --name uniswap_v3 --network base-mainnet --address 0x...

# Probe Blockscout reachability
base-mcp-server health
```

The server surfaces tools such as `getAccountSummary`, `getTransactions`,
`getContractABI`, `getLogs`, and `getDexRouterActivity`, returning small structured
payloads validated with zod.
