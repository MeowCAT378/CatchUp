import { Role } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';

const context = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as never;

describe('JwtAuthGuard current account checks', () => {
  it('rejects requests without a bearer token', async () => {
    const guard = new JwtAuthGuard({} as never, {} as never);

    await expect(
      guard.canActivate(context({ headers: {} })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('uses current database role instead of stale JWT claims', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    const guard = new JwtAuthGuard(
      {
        verify: jest.fn().mockReturnValue({
          sub: 'user',
          role: Role.HOST,
          tokenVersion: 4,
        }),
      } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'admin@example.test',
            role: Role.ADMIN,
            isDisabled: false,
            tokenVersion: 4,
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
            tokenVersion: 1,
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

  it('accepts a matching token version', async () => {
    const request = { headers: { authorization: 'Bearer current-token' } };
    const guard = new JwtAuthGuard(
      {
        verify: jest.fn().mockReturnValue({ sub: 'user', tokenVersion: 2 }),
      } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'teacher@example.test',
            role: Role.HOST,
            isDisabled: false,
            tokenVersion: 2,
          }),
        },
      } as never,
    );

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
  });

  it('accepts a legacy token only while the database version is zero', async () => {
    const guard = new JwtAuthGuard(
      { verify: jest.fn().mockReturnValue({ sub: 'user' }) } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'teacher@example.test',
            role: Role.HOST,
            isDisabled: false,
            tokenVersion: 0,
          }),
        },
      } as never,
    );

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer legacy-token' } }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects a stale token version with 401', async () => {
    const guard = new JwtAuthGuard(
      {
        verify: jest.fn().mockReturnValue({ sub: 'user', tokenVersion: 1 }),
      } as never,
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user',
            email: 'teacher@example.test',
            role: Role.HOST,
            isDisabled: false,
            tokenVersion: 2,
          }),
        },
      } as never,
    );

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer stale-token' } }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
