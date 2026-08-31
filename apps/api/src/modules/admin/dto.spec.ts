import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { CreateUserDto, ResetUserPasswordDto, UpdateUserRoleDto } from './dto';

describe('admin account DTOs', () => {
  it('accepts only normalized name, email, and password for creation', async () => {
    const dto = plainToInstance(CreateUserDto, {
      name: '  New Teacher  ',
      email: ' NEW@Example.Test ',
      password: 'password123',
      role: Role.ADMIN,
      isDisabled: true,
    });

    await expect(validate(dto, { whitelist: true })).resolves.toHaveLength(0);
    expect({ ...dto }).toEqual({
      name: 'New Teacher',
      email: 'new@example.test',
      password: 'password123',
    });
  });

  it.each(['short', 'ก'.repeat(25)])(
    'uses the shared password rules for reset',
    async (password) => {
      await expect(
        validate(plainToInstance(ResetUserPasswordDto, { password })),
      ).resolves.not.toHaveLength(0);
    },
  );

  it('accepts a valid shared password for reset', async () => {
    await expect(
      validate(
        plainToInstance(ResetUserPasswordDto, { password: 'password123' }),
      ),
    ).resolves.toHaveLength(0);
  });
});

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
