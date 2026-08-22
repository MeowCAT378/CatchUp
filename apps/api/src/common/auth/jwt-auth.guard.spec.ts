import { Role } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';

const context = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as never;

describe('JwtAuthGuard current account checks', () => {
  it('uses current database role instead of stale JWT claims', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    const guard = new JwtAuthGuard(
      {
        verify: jest.fn().mockReturnValue({ sub: 'user', role: Role.HOST }),
      } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'admin@example.test',
            role: Role.ADMIN,
            isDisabled: false,
          }),
        },
      } as never,
    );
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toMatchObject({ user: { role: Role.ADMIN } });
  });

  it('rejects a previously issued token after account disable', async () => {
    const guard = new JwtAuthGuard(
      { verify: jest.fn().mockReturnValue({ sub: 'user' }) } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'teacher@example.test',
            role: Role.HOST,
            isDisabled: true,
          }),
        },
      } as never,
    );
    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer old-token' } }),
      ),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED', status: 403 });
  });
});
