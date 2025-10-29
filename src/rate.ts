import { RateLimiterMemory } from 'rate-limiter-flexible';

export interface RateLimiterOptions {
  points: number;
  duration: number;
}

export type RateLimiter = RateLimiterMemory;

export const createRateLimiter = ({ points, duration }: RateLimiterOptions): RateLimiter =>
  new RateLimiterMemory({
    points,
    duration,
    keyPrefix: 'blockscout'
  });

export const consumeRateLimit = async (limiter: RateLimiter, key = 'global'): Promise<void> => {
  try {
    await limiter.consume(key);
  } catch (error) {
    throw new Error('Rate limit exceeded while calling Blockscout');
  }
};
