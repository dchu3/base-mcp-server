import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';

describe('config', () => {
  it('loads defaults when environment variables are absent', () => {
    const config = loadConfig();
    expect(config.port).toBe(7801);
    expect(config.baseNetwork).toBe('base-mainnet');
    expect(config.blockscoutBaseUrl).toContain('https://');
  });
});
