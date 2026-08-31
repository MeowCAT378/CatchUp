import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/auth/roles.decorator';
import { AdminController } from './admin.controller';

describe('AdminController authorization', () => {
  it('requires ADMIN for every endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('uses one authenticated rate limit for password-hashing writes', async () => {
    const service = {
      createUser: jest.fn().mockResolvedValue({ id: 'teacher' }),
      resetUserPassword: jest.fn().mockResolvedValue({ id: 'teacher' }),
    };
    const controller = new AdminController(service as never);
    const user = {
      sub: `admin-${Date.now()}`,
      email: 'admin@example.test',
      role: Role.ADMIN,
    };
    const dto = {
      name: 'Teacher',
      email: 'teacher@example.test',
      password: 'password123',
    };

    for (let count = 0; count < 10; count++)
      await controller.createUser(user, dto);

    expect(() =>
      controller.resetUserPassword(user, 'teacher', {
        password: 'new-password123',
      }),
    ).toThrow('Too many requests');
  });
});
