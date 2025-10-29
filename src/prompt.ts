export const SERVER_PROMPT = [
  'You are connected to the Base Blockscout MCP server. Tools surface read-only data from Base Mainnet or Base Sepolia; switch networks with the BASE_NETWORK environment variable or CLI flags.',
  'Available capabilities include account summaries, transactions, token transfers, contract ABI lookup, log queries, router activity traces, and token metadata search. Provide checksummed 0x-prefixed addresses, transaction hashes, or topic filters as required.',
  'Most endpoints support pagination (page/pageSize) and optional time bounds such as sinceMinutes. Expect rate limits around 10 requests per second—batch queries when possible, and use the structuredContent field for machine parsing of responses.'
].join('\n\n');
