import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, RegisterDto } from './dto';

describe('auth DTOs', () => {
  it('trims a valid registration name without changing the password', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'teacher@example.test',
      name: '  Teacher  ',
      password: ' password123 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.name).toBe('Teacher');
    expect(dto.password).toBe(' password123 ');
  });

  it.each([
    [
      {
        email: 'teacher@example.test',
        name: ' '.repeat(2),
        password: 'password123',
      },
    ],
    [
      {
        email: `${'a'.repeat(243)}@example.test`,
        name: 'Teacher',
        password: 'password123',
      },
    ],
    [
      {
        email: 'teacher@example.test',
        name: 'T'.repeat(101),
        password: 'password123',
      },
    ],
    [
      {
        email: 'teacher@example.test',
        name: 'Teacher',
        password: 'p'.repeat(73),
      },
    ],
  ])('rejects an oversized or blank registration field', async (input) => {
    await expect(
      validate(plainToInstance(RegisterDto, input)),
    ).resolves.not.toHaveLength(0);
  });

  it('bounds login credentials', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'teacher@example.test',
      password: 'p'.repeat(73),
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('rejects passwords longer than the bcrypt 72-byte limit', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'teacher@example.test',
      name: 'Teacher',
      password: 'ก'.repeat(25),
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
