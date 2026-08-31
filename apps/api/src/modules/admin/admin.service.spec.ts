import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  afterEach(() => jest.useRealTimers());

  it('counts sessions within Bangkok calendar-day bounds', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T18:00:00.000Z'));
    const roomCount = jest.fn().mockResolvedValue(3);
    const prisma = {
      user: { count: jest.fn().mockResolvedValue(1) },
      quiz: { count: jest.fn().mockResolvedValue(1) },
      room: { count: roomCount },
      $transaction: jest.fn().mockResolvedValue([1, 1, 1, 1, 3, 1]),
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.overview();

    expect(roomCount).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-08-22T17:00:00.000Z'),
          lt: new Date('2026-08-23T17:00:00.000Z'),
        },
      },
    });
  });

  it('counts ADMIN accounts as teaching-capable users in overview totals', async () => {
    const userCount = jest.fn().mockResolvedValue(1);
    const prisma = {
      user: { count: userCount },
      quiz: { count: jest.fn().mockResolvedValue(1) },
      room: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn().mockResolvedValue([1, 1, 1, 1, 1, 1]),
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.overview();

    expect(userCount).toHaveBeenNthCalledWith(1, {
      where: { role: { in: [Role.HOST, Role.ADMIN] } },
    });
    expect(userCount).toHaveBeenNthCalledWith(2, {
      where: {
        role: { in: [Role.HOST, Role.ADMIN] },
        isDisabled: false,
      },
    });
    expect(userCount).toHaveBeenNthCalledWith(3, {
      where: {
        role: { in: [Role.HOST, Role.ADMIN] },
        isDisabled: true,
      },
    });
  });

  it('creates an enabled HOST with a safe response and audit entry', async () => {
    const created = {
      id: 'teacher',
      name: 'New Teacher',
      email: 'new@example.test',
      role: Role.HOST,
      isDisabled: false,
      createdAt: new Date('2026-08-28T00:00:00.000Z'),
      updatedAt: new Date('2026-08-28T00:00:00.000Z'),
    };
    let createdPasswordHash = '';
    const create = jest
      .fn()
      .mockImplementation(({ data }: { data: { passwordHash: string } }) => {
        createdPasswordHash = data.passwordHash;
        return Promise.resolve(created);
      });
    const audit = jest.fn().mockResolvedValue(undefined);
    const tx = { user: { create }, adminAuditLog: { create: audit } };
    const service = new AdminService(
      {
        $transaction: jest
          .fn()
          .mockImplementation((work: (client: typeof tx) => unknown) =>
            work(tx),
          ),
      } as never,
      {} as never,
    );

    const result = await service.createUser('admin', {
      name: 'New Teacher',
      email: ' NEW@Example.Test ',
      password: 'password123',
    });

    expect(result).toEqual(created);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'New Teacher',
        email: 'new@example.test',
        passwordHash: createdPasswordHash,
        role: Role.HOST,
        isDisabled: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDisabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await expect(
      bcrypt.compare('password123', createdPasswordHash),
    ).resolves.toBe(true);
    expect(audit).toHaveBeenCalledWith({
      data: {
        adminId: 'admin',
        targetUserId: 'teacher',
        action: 'TEACHER_CREATED',
      },
    });
  });

  it('maps duplicate user creation to EMAIL_IN_USE', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const service = new AdminService(
      { $transaction: jest.fn().mockRejectedValue(duplicate) } as never,
      {} as never,
    );

    await expect(
      service.createUser('admin', {
        name: 'Teacher',
        email: 'teacher@example.test',
        password: 'password123',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_IN_USE', status: 409 });
  });

  it('resets HOST or ADMIN passwords atomically and invalidates self sessions', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'admin',
      role: Role.ADMIN,
    });
    let resetPasswordHash = '';
    const update = jest
      .fn()
      .mockImplementation(({ data }: { data: { passwordHash: string } }) => {
        resetPasswordHash = data.passwordHash;
        return Promise.resolve({ id: 'admin' });
      });
    const audit = jest.fn().mockResolvedValue(undefined);
    const tx = {
      user: { findFirst, update },
      adminAuditLog: { create: audit },
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
    };
    const disconnectHost = jest.fn();
    const service = new AdminService(
      prisma as never,
      { disconnectHost } as never,
    );

    const result = await service.resetUserPassword('admin', 'admin', {
      password: 'new-password123',
    });

    expect(result).toEqual({ id: 'admin', currentSessionInvalidated: true });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'admin', role: { in: [Role.HOST, Role.ADMIN] } },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'admin' },
      data: {
        passwordHash: resetPasswordHash,
        tokenVersion: { increment: 1 },
      },
      select: { id: true },
    });
    await expect(
      bcrypt.compare('new-password123', resetPasswordHash),
    ).resolves.toBe(true);
    expect(audit).toHaveBeenCalledWith({
      data: {
        adminId: 'admin',
        targetUserId: 'admin',
        action: 'USER_PASSWORD_RESET',
      },
    });
    expect(disconnectHost).toHaveBeenCalledWith('admin');
  });

  it('soft-disables teacher, writes audit, and disconnects host sockets', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'teacher',
      role: Role.HOST,
      isDisabled: true,
    });
    const audit = jest.fn();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'teacher',
          role: Role.HOST,
          isDisabled: false,
        }),
        update,
      },
      adminAuditLog: { create: audit },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    const disconnectHost = jest.fn();
    const service = new AdminService(
      prisma as never,
      { disconnectHost } as never,
    );
    await service.updateStatus('admin', 'teacher', { isDisabled: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isDisabled: true, tokenVersion: { increment: 1 } },
      }),
    );
    expect(audit).toHaveBeenCalledWith({
      data: {
        adminId: 'admin',
        targetUserId: 'teacher',
        action: 'TEACHER_DISABLED',
      },
    });
    expect(disconnectHost).toHaveBeenCalledWith('teacher');
  });

  it('re-enables an account without restoring its token version', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'teacher',
      role: Role.HOST,
      isDisabled: false,
    });
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'teacher',
          role: Role.HOST,
          isDisabled: true,
        }),
        update,
      },
      adminAuditLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (work: (tx: typeof prisma) => unknown) => work(prisma),
    );
    const disconnectHost = jest.fn();
    const service = new AdminService(
      prisma as never,
      { disconnectHost } as never,
    );

    await service.updateStatus('admin', 'teacher', { isDisabled: false });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isDisabled: false } }),
    );
    expect(disconnectHost).not.toHaveBeenCalled();
  });

  it('promotes a HOST by changing only the role and recording an audit entry', async () => {
    const original = {
      id: 'teacher',
      name: 'Existing Teacher',
      email: 'teacher@example.test',
      role: Role.HOST,
      isDisabled: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    let stored = { ...original, role: original.role as Role };
    const audit: { adminId: string; targetUserId: string; action: string }[] =
      [];
    const tx = {
      user: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(stored)),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: { role: Role } }) => {
            stored = { ...stored, ...data };
            return Promise.resolve(stored);
          }),
      },
      adminAuditLog: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: (typeof audit)[number] }) => {
            audit.push(data);
            return Promise.resolve(data);
          }),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest
        .fn()
        .mockImplementation((work: (transaction: typeof tx) => unknown) =>
          work(tx),
        ),
    };
    const service = new AdminService(prisma as never, {} as never);

    const promoted = await service.updateRole('admin', 'teacher', {
      role: Role.ADMIN,
    });

    expect(promoted).toMatchObject({
      id: original.id,
      name: original.name,
      email: original.email,
      role: Role.ADMIN,
      isDisabled: original.isDisabled,
      createdAt: original.createdAt,
    });
    expect(audit).toEqual([
      {
        adminId: 'admin',
        targetUserId: 'teacher',
        action: 'TEACHER_PROMOTED_TO_ADMIN',
      },
    ]);
  });

  it('rejects self role changes', async () => {
    const service = new AdminService({} as never, {} as never);

    await expect(
      service.updateRole('admin', 'admin', { role: Role.ADMIN }),
    ).rejects.toMatchObject({
      code: 'SELF_ROLE_CHANGE',
    });
  });

  it('rejects role transitions other than HOST to ADMIN', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'other-admin',
          role: Role.ADMIN,
        }),
      },
    };
    const service = new AdminService(prisma as never, {} as never);

    await expect(
      service.updateRole('admin', 'other-admin', { role: Role.HOST }),
    ).rejects.toMatchObject({ code: 'INVALID_ROLE_TRANSITION' });
  });

  it('rejects promotion when the target user does not exist', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AdminService(prisma as never, {} as never);

    await expect(
      service.updateRole('admin', 'missing', { role: Role.ADMIN }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND', status: 404 });
  });

  it('keeps ADMIN accounts visible in the managed-user list', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      user: { findMany, count },
      room: { groupBy: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new AdminService(prisma as never, {} as never);

    await service.teachers({
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: [Role.HOST, Role.ADMIN] } },
      }),
    );
  });

  it('loads an ADMIN account from managed-user details', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'promoted',
      role: Role.ADMIN,
      quizzes: [],
      _count: { hostedRooms: 0 },
    });
    const service = new AdminService(
      { user: { findFirst } } as never,
      {} as never,
    );

    await service.teacher('promoted');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'promoted',
          role: { in: [Role.HOST, Role.ADMIN] },
        },
      }),
    );
  });
});
