import { Role } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService teacher status', () => {
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
      $transaction: jest.fn((work: (tx: unknown) => unknown) => work(prisma)),
    };
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
