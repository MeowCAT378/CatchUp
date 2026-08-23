import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects calls above the limit and resets after the window', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const key = `test:${Math.random()}`;

    for (let attempt = 0; attempt < 3; attempt++)
      expect(() => checkRateLimit(key, 3, 60_000)).not.toThrow();
    let error: unknown;
    try {
      checkRateLimit(key, 3, 60_000);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });

    now.mockReturnValue(61_001);
    expect(() => checkRateLimit(key, 3, 60_000)).not.toThrow();
  });
});
