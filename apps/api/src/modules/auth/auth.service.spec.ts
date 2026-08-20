import { Prisma } from '@prisma/client';
import { AuthService, normalizeEmail } from './auth.service';

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
});
