# base-mcp-server — Requirements (TypeScript / Node.js)

## 1) Purpose
Create an MCP server that wraps the Blockscout API for Base (Mainnet + Base Sepolia). The server exposes a compact set of MCP tools for natural-language agents to fetch account, contract, token, and transaction telemetry and to quickly inspect DEX router activity (Uniswap, Aerodrome, PancakeSwap).

Target use: consumed by base-mcp-bot (Python) and other MCP-capable agents.

---

## 2) Scope
- Provide a Node.js TypeScript MCP server process exposing JSON-serialisable tools.
- Proxy and normalise Blockscout endpoints for the Base networks.
- Add convenience tools for DEX router activity, contract ABI, token transfers, search, and logs.
- Support rate limiting, basic caching, and retries.
- Provide typed schemas (zod) for input/output and robust error handling.
- Ship with CLI, Dockerfile, config via env, health endpoint, and basic tests.

Non-goals
- No private key usage or on-chain writes.
- No direct DB writes (in-memory cache only).

---

## 3) Tech Stack
- Runtime: Node.js >= 20
- Language: TypeScript
- Libs: zod, undici (fetch), p-retry, lru-cache, rate-limiter-flexible, dotenv, yargs (CLI)
- MCP: @modelcontextprotocol/sdk (server)
- Testing: vitest + tsup for build
- Lint/Format: eslint, prettier
- Container: Docker (alpine or distroless)

---

## 4) Configuration
Environment variables (with sane defaults):
```
NODE_ENV=development
PORT=7801
LOG_LEVEL=info

# Network selection: base-mainnet | base-sepolia
BASE_NETWORK=base-mainnet

# Blockscout endpoints
BLOCKSCOUT_MAINNET=https://base.blockscout.com/api
BLOCKSCOUT_SEPOLIA=https://base-sepolia.blockscout.com/api

# Optional API key if Blockscout adds one later
BLOCKSCOUT_API_KEY=

# Caching / rate limits
CACHE_TTL_MS=15000
CACHE_MAX=500
RATE_POINTS=10
RATE_DURATION_S=1
RETRY_ATTEMPTS=3
RETRY_MIN_MS=250
RETRY_MAX_MS=1500
```

Network routing:
- If BASE_NETWORK=base-sepolia, use BLOCKSCOUT_SEPOLIA.
- Else default to mainnet.

---

## 5) MCP Tools (Functions)
All tool inputs/outputs must be validated with zod and return JSON that is small and agent-friendly.

1. getAccountSummary
   - input: { address: string }
   - returns: ETH balance, tx count, token balances (top 20 by value), ENS if any.
2. getTransactions
   - input: { address: string, page?: number, pageSize?: number, direction?: "in"|"out"|"all" }
   - returns: simplified tx list (hash, from, to, value, method, status, timestamp).
3. getTransactionByHash
   - input: { hash: string }
   - returns: core fields + decoded method (if ABI known) + logs summary.
4. getContractABI
   - input: { address: string }
   - returns: ABI (if verified) with metadata (compiler, evmVersion, verifiedAt).
5. getTokenTransfers
   - input: { address: string, page?: number, pageSize?: number }
   - returns: ERC-20 transfer events normalised.
6. search
   - input: { query: string } (hash / addr / token / label)
   - returns: first 10 matches with type + canonical address/hash.
7. getLogs
   - input: { address?: string, topics?: string[], fromBlock?: number, toBlock?: number, page?: number }
   - returns: compact log entries.
8. getDexRouterActivity
   - input: { router: string, sinceMinutes?: number, page?: number, pageSize?: number }
   - behaviour: recent txns where to==router; decode common swap methods when ABI known.
   - returns: list of { hash, from, method, tokens?, amountIn?, amountOutMin?, timestamp }.
9. resolveToken
   - input: { address: string }
   - returns: symbol, name, decimals, totalSupply, holders? (if available).

Where Blockscout returns paginated lists, expose page/pageSize and include nextPage if applicable.

---

## 6) DEX Router Defaults
Ship a constants file with known routers (addresses are editable via env/JSON):
```ts
export const ROUTERS = {
  uniswap_v3: {
    mainnet: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    sepolia:  "0x0000000000000000000000000000000000000000"
  },
  aerodrome_v2: {
    mainnet: "0xC5cf4D1A...",
    sepolia:  "0x0000000000000000000000000000000000000000"
  },
  pancakeswap_v3: {
    mainnet: "0x...",
    sepolia:  "0x0000000000000000000000000000000000000000"
  }
};
```
Keep values in a JSON file so users can override without recompiling. Provide a CLI command routers print|set|get.

---

## 7) CLI
- base-mcp-server start — start MCP server (reads env)
- base-mcp-server routers print — print router table
- base-mcp-server health — quick self-check of Blockscout reachability
- Flags: --port, --network, --log-level, --config

---

## 8) Server Behaviour
- HTTP health on /healthz (OK 200 JSON).
- MCP transport over stdio (default) and optional HTTP SSE for dev.
- LRU cache on read endpoints; cache keyed by URL + params.
- Backoff + limited concurrency to play nice with Blockscout.
- Structured logs (JSON) with optional redaction.

---

## 9) Project Layout
```
/src
  index.ts            # MCP bootstrap
  server.ts           # tool registry
  blockscout.ts       # HTTP client + DTOs
  tools/              # zod schemas + handlers
  routers.ts          # known router map + helpers
  cache.ts            # LRU cache wrapper
  rate.ts             # limiter
  config.ts           # env + defaults
  utils.ts
/tests
  unit/               # vitest specs for each tool
  integration/        # live hits behind a flag
scripts/
  dev.sh              # ts-node watch
  build.sh            # tsup bundle
```
---

## 10) Deliverables
- package.json scripts: dev, build, start, test, lint, format
- Dockerfile + .dockerignore
- README.md with examples of calling each MCP tool
- .env.example
- Vitest unit tests for tool schemas + happy/failure paths

---

## 11) Acceptance Criteria
- Starts with npm run start and registers all tools.
- Switching BASE_NETWORK flips endpoints.
- getDexRouterActivity returns at least the last 10 txns for a router within 5s on a warm cache.
- All tool inputs/outputs validated via zod.
- 90%+ lines covered on pure functions (schemas/utils).

---

## 12) Nice-to-Haves
- Optional method decoder (4-byte sig) using a lightweight registry.
- OpenAPI dump for the proxy layer (dev aid).
- Prometheus metrics on a port guard flag.
