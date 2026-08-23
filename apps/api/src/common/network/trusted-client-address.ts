import { isIP } from 'node:net';

const trustProxyError = 'TRUST_PROXY_HOPS must be an integer from 0 to 10';

export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^(?:[0-9]|10)$/.test(value)) throw new Error(trustProxyError);
  return Number(value);
}

export function trustedClientAddress(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string {
  const fallback = remoteAddress || 'unknown';
  if (trustedHops === 0 || forwardedFor === undefined) return fallback;
  const addresses = (
    Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor
  )
    .split(',')
    .map((address) => address.trim());
  const address = addresses.at(-trustedHops);
  return address && isIP(address) ? address : fallback;
}
