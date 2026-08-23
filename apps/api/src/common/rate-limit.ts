import { AppError } from './app-error';

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_KEYS = 10_000;

// ponytail: process-local limits fit one on-prem API instance; use shared ingress/store limits before horizontal scaling.
export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (!current && buckets.size >= MAX_KEYS) {
      for (const [storedKey, bucket] of buckets)
        if (bucket.resetAt <= now) buckets.delete(storedKey);
      if (buckets.size >= MAX_KEYS)
        throw new AppError('RATE_LIMITED', 429, 'Too many requests');
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit)
    throw new AppError('RATE_LIMITED', 429, 'Too many requests');
  current.count += 1;
}
