import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/auth/roles.decorator';
import { AdminController } from './admin.controller';

describe('AdminController authorization', () => {
  it('requires ADMIN for every endpoint', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      Role.ADMIN,
    ]);
  });
});
