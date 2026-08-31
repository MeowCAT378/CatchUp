import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('allows ADMIN when an endpoint requires HOST capabilities', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.HOST]),
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'admin', email: 'admin@example.test', role: Role.ADMIN },
        }),
      }),
    };

    const allowed = new RolesGuard(
      reflector as unknown as Reflector,
    ).canActivate(context as unknown as ExecutionContext);

    expect(allowed).toBe(true);
  });

  it('does not allow HOST when an endpoint requires ADMIN', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'host', email: 'host@example.test', role: Role.HOST },
        }),
      }),
    };

    const allowed = new RolesGuard(
      reflector as unknown as Reflector,
    ).canActivate(context as unknown as ExecutionContext);

    expect(allowed).toBe(false);
  });
});
