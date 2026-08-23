import { Role } from '@prisma/client';
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
      expect.objectContaining({ data: { isDisabled: true } }),
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
});
