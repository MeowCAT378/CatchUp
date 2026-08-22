import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoryQueryDto } from './history.dto';

@Injectable()
export class RoomHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(viewer: AuthUser, query: HistoryQueryDto) {
    const date: Prisma.DateTimeFilter = {};
    if (query.from) date.gte = new Date(query.from);
    if (query.to) {
      const exclusiveEnd = new Date(query.to);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      date.lt = exclusiveEnd;
    }
    const where: Prisma.RoomWhereInput = {
      hostId:
        viewer.role === Role.ADMIN ? query.teacherId || undefined : viewer.sub,
      activityType: query.activityType,
      status: query.status,
      ...(Object.keys(date).length ? { createdAt: date } : {}),
      ...(query.search
        ? {
            OR: [
              {
                activityTitle: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        select: {
          id: true,
          code: true,
          activityTitle: true,
          activityType: true,
          status: true,
          phase: true,
          createdAt: true,
          startedAt: true,
          endedAt: true,
          host: { select: { id: true, name: true, email: true } },
          _count: { select: { participants: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.room.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...room }) => ({
        ...room,
        participantCount: _count.participants,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
