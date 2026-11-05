import { Ratelimit, type RatelimitConfig } from '@upstash/ratelimit';
import { redis } from './client';

export const createRateLimiter = (props: Omit<RatelimitConfig, 'redis'>) =>
  new Ratelimit({
    redis,
    limiter: props.limiter ?? Ratelimit.slidingWindow(10, '10 s'),
    prefix: props.prefix ?? 'agent-pay',
  });

export const { slidingWindow } = Ratelimit;
