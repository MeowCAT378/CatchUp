import { Prisma } from '@prisma/client';
import { AuthService, normalizeEmail } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('normalizeEmail', () => {
  it('trims and lowercases emails without changing passwords', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
  });

  it('maps a concurrent duplicate registration to EMAIL_IN_USE', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const service = new AuthService(
      { user: { create: jest.fn().mockRejectedValue(duplicate) } } as never,
      {} as never,
    );

    await expect(
      service.register({
        email: 'teacher@example.test',
        name: 'Teacher',
        password: 'password123',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_IN_USE', status: 409 });
  });

  it('rejects valid credentials for a disabled account', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const service = new AuthService(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'teacher',
            email: 'teacher@example.test',
            passwordHash,
            role: 'HOST',
            isDisabled: true,
          }),
        },
      } as never,
      {} as never,
    );
    await expect(
      service.login({
        email: 'teacher@example.test',
        password: 'password123',
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED', status: 403 });
  });
});
