import {
  parseTrustProxyHops,
  trustedClientAddress,
} from './trusted-client-address';

describe('parseTrustProxyHops', () => {
  it('defaults to no trusted proxies', () => {
    expect(parseTrustProxyHops(undefined)).toBe(0);
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['10', 10],
  ])('accepts %s trusted hops', (value, expected) => {
    expect(parseTrustProxyHops(value)).toBe(expected);
  });

  it.each(['', '-1', '11', '1.5', '01', 'proxy'])('rejects %s', (value) => {
    expect(() => parseTrustProxyHops(value)).toThrow(
      'TRUST_PROXY_HOPS must be an integer from 0 to 10',
    );
  });
});

describe('trustedClientAddress', () => {
  const remoteAddress = '10.0.0.9';

  it('ignores spoofable forwarding headers by default', () => {
    expect(trustedClientAddress(remoteAddress, '203.0.113.1', 0)).toBe(
      remoteAddress,
    );
  });

  it('walks the forwarding chain from the server side', () => {
    const chain = '198.51.100.8, 10.0.0.1';

    expect(trustedClientAddress(remoteAddress, chain, 1)).toBe('10.0.0.1');
    expect(trustedClientAddress(remoteAddress, chain, 2)).toBe('198.51.100.8');
  });

  it('supports repeated forwarding headers', () => {
    expect(
      trustedClientAddress(remoteAddress, ['198.51.100.8', '10.0.0.1'], 2),
    ).toBe('198.51.100.8');
  });

  it.each([
    [undefined, 1],
    ['198.51.100.8', 2],
    ['not-an-ip', 1],
  ] as const)('falls back for an unusable chain', (forwardedFor, hops) => {
    expect(trustedClientAddress(remoteAddress, forwardedFor, hops)).toBe(
      remoteAddress,
    );
  });
});
