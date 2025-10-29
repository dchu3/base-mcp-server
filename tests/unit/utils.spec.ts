import { describe, expect, it } from 'vitest';

import { buildQueryString, formatWeiToEther } from '../../src/utils.js';

describe('utils', () => {
  describe('buildQueryString', () => {
    it('serialises query parameters', () => {
      expect(buildQueryString({ a: 1, b: 'two' })).toBe('?a=1&b=two');
    });

    it('skips undefined values', () => {
      expect(buildQueryString({ a: undefined, b: 'two' })).toBe('?b=two');
    });
  });

  describe('formatWeiToEther', () => {
    it('formats whole values', () => {
      expect(formatWeiToEther('1000000000000000000')).toBe('1');
    });

    it('formats fractional values', () => {
      expect(formatWeiToEther('1500000000000000000')).toBe('1.5');
    });

    it('handles invalid input', () => {
      expect(formatWeiToEther('not-a-number')).toBe('0');
    });
  });
});
