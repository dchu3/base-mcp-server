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

### `getContractABI` Tool

- Calls `GET /v2/smart-contracts/{address}` to fetch the verified ABI plus compiler metadata.
- Parses ABI payloads whether Blockscout returns a JSON string (`abi`, `result`, or `abi_json`)
  or a pre-parsed array, so agents always receive a normalized ABI array when available.
- Surfaces compiler version, EVM version, and verification timestamp fields under a single
  `metadata` object (`verified` falls back to `true` if the endpoint returns an ABI even when
  explicit flags are missing).

### `getTransactionByHash` Tool

- Wraps `GET /v2/transactions/{hash}` to return a normalized view of a single transaction,
  including decoded method data when Blockscout has verified the contract ABI.
- Normalizes values from both string and object fields (addresses, fees, nested `from`/`to`
  objects) so callers always receive plain strings for hash, `from`, `to`, and raw input.
- Surfaces the extended Blockscout telemetry—gas/fee metrics, layer-1 usage, nonce,
  confirmations, position, transaction types, and pending status—alongside the original
  success/fail/pending status flag.

### `resolveToken` Tool

- Hits `GET /v2/tokens/{address}` to retrieve token metadata for fungible contracts.
- Normalizes Blockscout’s varying field names (`name` vs `token_name`, `symbol` vs
  `token_symbol`, etc.) so callers always receive consistent `name`, `symbol`, `decimals`,
  `totalSupply`, `holders`, and `type` fields.
- Parses numeric strings (decimals, holder count) and gracefully returns `null` when the
  explorer omits a field.

### `getAccountSummary` Tool

- Aggregates `/v2/addresses/{address}`, `/v2/addresses/{address}/token-balances`, and
  `/v2/addresses/{address}/counters` in parallel to produce an ETH balance, nonce,
  transaction count, and top ERC-20 balances.
- Normalizes balance fields into both wei and ether via `formatWeiToEther`, and converts
  string counters/nonces into numbers, defaulting to zero/null when Blockscout omits a value.
- Collapses token-balance payloads from either arrays or `{items}` structures and returns the
  first 20 entries with symbol/name/decimals and optional USD estimates.

### `getDexRouterActivity` Tool

- Calls `/v2/addresses/{router}/transactions` with `filter=to` and follows
  `next_page_params` cursors to gather enough samples for the requested page/pageSize.
- Supports `sinceMinutes` filtering by stopping pagination when timestamps are older than the
  cutoff; transactions are normalized to include decoded method data, sender, value, and
  optional `decoded` ABI parameters.
- Returns deterministic pagination (server-side cursor + client-side slicing) so repeated
  calls with the same inputs produce consistent batches.

### `getLogs` Tool

- If a `transactionHash` is provided, hits `/v2/transactions/{hash}/logs`; otherwise calls
  `/v2/logs` with address/topic filters plus `page/page_size` query params.
- Accepts up to four topics, optional block range, and uses response `next_page` cursors when
  scanning across blocks.
- Normalizes log entries to guarantee `topics` arrays, numeric `blockNumber/logIndex`, and
  unix timestamps even when Blockscout returns ISO strings.

### `getTokenTransfers` Tool

- Wraps `/v2/tokens/{address}/transfers`, exposing a simple cursor `{blockNumber, index}`
  backed by Blockscout’s `next_page_params` so clients can request the next batch precisely.
- Normalizes each transfer’s token metadata, participants, amount, and timestamp by merging
  fields like `token.*`, `contract.*`, and `total.value`.
- Timestamps accept raw seconds, milliseconds, or ISO strings and are coerced to epoch
  seconds to keep downstream calculations simple.

Agent connection instructions live in `src/prompt.ts`; update this file when you need to
adjust the guidance delivered to MCP clients.
