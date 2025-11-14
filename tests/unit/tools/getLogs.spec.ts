import { describe, expect, it, vi } from 'vitest';

import type { BlockscoutClient } from '../../../src/blockscout.js';
import { getLogsTool } from '../../../src/tools/getLogs.js';

describe('getLogsTool', () => {
  it('fetches logs for a specific transaction hash', async () => {
    const client: Partial<BlockscoutClient> = {
      getTransactionLogs: vi.fn().mockResolvedValue({
        items: [
          {
            address: '0xabc',
            data: '0x01',
            topics: ['0xdeadbeef'],
            block_number: '10',
            transaction_hash: '0xhash',
            log_index: '2',
            timestamp: '1700'
          }
        ]
      })
    };

    const result = await getLogsTool.execute(
      { transactionHash: '0xa3ef98eb2200131dce3688c5ce9e6a00e5601b2d0cdbfd4c0a0d6ce3492926b6' },
      { client: client as BlockscoutClient, routers: {} as never }
    );

    expect(client.getTransactionLogs).toHaveBeenCalledWith(
      '0xa3ef98eb2200131dce3688c5ce9e6a00e5601b2d0cdbfd4c0a0d6ce3492926b6'
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      address: '0xabc',
      data: '0x01',
      topics: ['0xdeadbeef'],
      blockNumber: 10,
      transactionHash: '0xhash',
      logIndex: 2,
      timestamp: 1700
    });
    expect(result.page).toBe(1);
    expect(result.nextPage).toBeNull();
  });

  it('falls back to the legacy logs endpoint when filters are provided', async () => {
    const client: Partial<BlockscoutClient> = {
      getLogs: vi.fn().mockResolvedValue({
        items: [
          {
            address: '0xdef',
            data: '0x02',
            topics: ['0xbeef'],
            block_number: 20,
            tx_hash: '0xother',
            index: 5,
            block_timestamp: 1800
          }
        ],
        next_page: '3'
      })
    };

    const result = await getLogsTool.execute(
      { address: '0xdef', page: 2, pageSize: 50 },
      { client: client as BlockscoutClient, routers: {} as never }
    );

    expect(client.getLogs).toHaveBeenCalledWith({
      address: '0xdef',
      topics: undefined,
      from_block: undefined,
      to_block: undefined,
      page: 2,
      page_size: 50
    });
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.nextPage).toBe(3);
  });
});
