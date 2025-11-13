import { describe, expect, it, vi } from 'vitest';

import type { BlockscoutClient } from '../../../src/blockscout.js';
import { getTokenTransfersTool } from '../../../src/tools/getTokenTransfers.js';

describe('getTokenTransfersTool', () => {
  it('normalizes token transfer responses', async () => {
    const client: Partial<BlockscoutClient> = {
      getTokenTransfers: vi.fn().mockResolvedValue({
        items: [
          {
            transaction_hash: '0xabc',
            log_index: '1',
            block_number: '10',
            timestamp: '2024-01-01T00:00:00Z',
            from: { hash: '0xfrom' },
            to: { hash: '0xto' },
            token: {
              address_hash: '0xtoken',
              symbol: 'TOK',
              name: 'Token',
              decimals: '18'
            },
            total: {
              value: '123',
              decimals: '18'
            },
            type: 'token_transfer'
          }
        ],
        next_page_params: {
          block_number: '8',
          index: '20'
        }
      })
    };

    const result = await getTokenTransfersTool.execute(
      { address: '0xtoken' },
      { client: client as BlockscoutClient, routers: {} as never }
    );

    expect(client.getTokenTransfers).toHaveBeenCalledWith('0xtoken', undefined);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      hash: '0xabc',
      logIndex: 1,
      blockNumber: 10,
      timestamp: 1704067200,
      from: '0xfrom',
      to: '0xto',
      token: {
        address: '0xtoken',
        symbol: 'TOK',
        name: 'Token',
        decimals: 18
      },
      amount: '123',
      type: 'token_transfer'
    });
    expect(result.cursor).toBeNull();
    expect(result.nextCursor).toEqual({ blockNumber: 8, index: 20 });
  });

  it('passes cursor params when provided', async () => {
    const client: Partial<BlockscoutClient> = {
      getTokenTransfers: vi.fn().mockResolvedValue({
        items: [],
        next_page_params: null
      })
    };

    await getTokenTransfersTool.execute(
      {
        address: '0xtoken',
        cursor: { blockNumber: 100, index: 5 }
      },
      { client: client as BlockscoutClient, routers: {} as never }
    );

    expect(client.getTokenTransfers).toHaveBeenCalledWith('0xtoken', {
      block_number: 100,
      index: 5
    });
  });
});
