import { getAccountSummaryTool } from './getAccountSummary.js';
import { getContractABITool } from './getContractABI.js';
import { getDexRouterActivityTool } from './getDexRouterActivity.js';
import { getLogsTool } from './getLogs.js';
import { getTokenTransfersTool } from './getTokenTransfers.js';
import { getTransactionByHashTool } from './getTransactionByHash.js';
import { getTransactionsTool } from './getTransactions.js';
import { resolveTokenTool } from './resolveToken.js';
import { searchTool } from './search.js';

export const tools = [
  getAccountSummaryTool,
  getTransactionsTool,
  getTransactionByHashTool,
  getContractABITool,
  getTokenTransfersTool,
  searchTool,
  getLogsTool,
  getDexRouterActivityTool,
  resolveTokenTool
];
