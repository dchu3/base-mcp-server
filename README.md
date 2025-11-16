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

### `getTransactions` Tool

- Hits the Blockscout endpoint `GET /v2/addresses/{address}/transactions`, so an address
  is always required.
- Filters by direction using Blockscout’s `filter=from|to` derived from the MCP-level
  `direction` parameter, matching the curl example (`filter=to`) when you pass
  `direction: 'in'`.
- Normalizes each transaction record (hash/source/destination/timestamp/status) so the
  response shape is consistent even when Blockscout renames fields (`hash` vs
  `tx_hash`, `method` vs `call_type`, etc.).
- Surfaces Blockscout’s keyset pagination under a `nextCursor` object. To fetch the next
  batch of results, pass that `nextCursor` back as the `cursor` input (the tool merges the
  opaque keyset params with your latest direction filter).

Agent connection instructions live in `src/prompt.ts`; update this file when you need to
adjust the guidance delivered to MCP clients.
