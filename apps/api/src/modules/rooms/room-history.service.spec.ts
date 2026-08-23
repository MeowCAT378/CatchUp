import { Role } from '@prisma/client';
import { RoomHistoryService } from './room-history.service';

describe('RoomHistoryService ownership', () => {
  it('forces teacher history to current owner', async () => {
    let queriedHostId: string | undefined;
    const findMany = jest.fn((query: { where: { hostId?: string } }) => {
      queriedHostId = query.where.hostId;
      return Promise.resolve([]);
    });
    const prisma = {
      room: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    await new RoomHistoryService(prisma as never).list(
      { sub: 'teacher-a', email: 'a@example.test', role: Role.HOST },
      { teacherId: 'teacher-b', page: 1, pageSize: 20 },
    );
    expect(queriedHostId).toBe('teacher-a');
  });

  it('allows admin to filter a selected teacher', async () => {
    let queriedHostId: string | undefined;
    const findMany = jest.fn((query: { where: { hostId?: string } }) => {
      queriedHostId = query.where.hostId;
      return Promise.resolve([]);
    });
    const prisma = {
      room: { findMany, count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    await new RoomHistoryService(prisma as never).list(
      { sub: 'admin', email: 'admin@example.test', role: Role.ADMIN },
      { teacherId: 'teacher-b', page: 1, pageSize: 20 },
    );
    expect(queriedHostId).toBe('teacher-b');
  });
});
