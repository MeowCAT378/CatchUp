import { ConfigService } from '@nestjs/config';
import { jwtOptions } from './auth.module';

describe('JWT configuration', () => {
  it.each([undefined, 'x'.repeat(31)])(
    'rejects a missing or short secret',
    (secret) => {
      const config = { get: jest.fn().mockReturnValue(secret) } as never;
      expect(() => jwtOptions(config)).toThrow(
        'JWT_SECRET must be at least 32 characters',
      );
    },
  );

  it('accepts a 32-character secret', () => {
    const config = {
      get: jest.fn().mockReturnValue('x'.repeat(32)),
    } as unknown as ConfigService;
    expect(jwtOptions(config).secret).toHaveLength(32);
  });
});
