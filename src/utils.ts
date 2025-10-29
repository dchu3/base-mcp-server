import { z } from 'zod';

export const buildQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const checksumAddress = (address: string): string => {
  if (!address) {
    return address;
  }
  const normalized = address.toLowerCase();
  if (!normalized.startsWith('0x')) {
    return address;
  }
  return normalized;
};

export const optionalNumber = (value: unknown): number | undefined => {
  const schema = z.coerce.number();
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return schema.parse(value);
};

export const formatWeiToEther = (wei: string): string => {
  if (!wei) {
    return '0';
  }

  try {
    const big = BigInt(wei);
    const divisor = BigInt(1e18);
    const whole = big / divisor;
    const remainder = big % divisor;
    if (remainder === BigInt(0)) {
      return whole.toString();
    }
    const padded = remainder.toString().padStart(18, '0').replace(/0+$/, '');
    return `${whole.toString()}.${padded}`;
  } catch {
    return '0';
  }
};
