import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { UpdateUserRoleDto } from './dto';

describe('UpdateUserRoleDto', () => {
  it('rejects role values outside the persisted Role enum', async () => {
    const dto = plainToInstance(UpdateUserRoleDto, { role: 'SUPER_ADMIN' });

    const errors = await validate(dto, { forbidUnknownValues: false });

    expect(errors).toHaveLength(1);
  });

  it('accepts ADMIN as a requested role', async () => {
    const dto = plainToInstance(UpdateUserRoleDto, { role: Role.ADMIN });

    const errors = await validate(dto, { forbidUnknownValues: false });

    expect(errors).toHaveLength(0);
  });
});
