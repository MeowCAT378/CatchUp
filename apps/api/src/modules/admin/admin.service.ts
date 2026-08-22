import { Injectable } from '@nestjs/common';
import { Prisma, Role, RoomStatus } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsGateway } from '../rooms/rooms.gateway';
import {
  TeacherQueryDto,
  UpdateTeacherDto,
  UpdateTeacherStatusDto,
} from './dto';

const teacherSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isDisabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomsGateway: RoomsGateway,
  ) {}

  async overview() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [
      totalTeachers,
      activeTeachers,
      disabledTeachers,
      activities,
      todaySessions,
      completedSessions,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: Role.HOST } }),
      this.prisma.user.count({
        where: { role: Role.HOST, isDisabled: false },
      }),
      this.prisma.user.count({
        where: { role: Role.HOST, isDisabled: true },
      }),
      this.prisma.quiz.count({ where: { deletedAt: null } }),
      this.prisma.room.count({ where: { createdAt: { gte: today } } }),
      this.prisma.room.count({ where: { status: RoomStatus.FINISHED } }),
    ]);
    return {
      totalTeachers,
      activeTeachers,
      disabledTeachers,
      activities,
      todaySessions,
      completedSessions,
    };
  }

  async teachers(query: TeacherQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: Role.HOST,
      ...(query.status ? { isDisabled: query.status === 'DISABLED' } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          ...teacherSelect,
          _count: {
            select: {
              quizzes: { where: { deletedAt: null } },
              hostedRooms: true,
            },
          },
        },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    const latest = items.length
      ? await this.prisma.room.groupBy({
          by: ['hostId'],
          where: { hostId: { in: items.map(({ id }) => id) } },
          _max: { startedAt: true, createdAt: true },
        })
      : [];
    const latestByTeacher = new Map(latest.map((item) => [item.hostId, item]));
    return {
      items: items.map(({ _count, ...teacher }) => ({
        ...teacher,
        activityCount: _count.quizzes,
        sessionCount: _count.hostedRooms,
        lastActivityAt:
          latestByTeacher.get(teacher.id)?._max.startedAt ??
          latestByTeacher.get(teacher.id)?._max.createdAt ??
          null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async teacher(id: string) {
    const teacher = await this.prisma.user.findFirst({
      where: { id, role: Role.HOST },
      select: {
        ...teacherSelect,
        quizzes: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            createdAt: true,
            updatedAt: true,
            questions: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                text: true,
                position: true,
                choices: {
                  select: { id: true, text: true, isCorrect: true },
                },
              },
            },
            _count: { select: { rooms: true } },
            rooms: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { startedAt: true, createdAt: true },
            },
          },
        },
        _count: { select: { hostedRooms: true } },
      },
    });
    if (!teacher)
      throw new AppError('TEACHER_NOT_FOUND', 404, 'Teacher not found');
    const { quizzes, _count, ...profile } = teacher;
    return {
      ...profile,
      sessionCount: _count.hostedRooms,
      activities: quizzes.map(({ _count: count, rooms, ...quiz }) => ({
        ...quiz,
        questionCount: quiz.questions.length,
        sessionCount: count.rooms,
        lastUsedAt: rooms[0]?.startedAt ?? rooms[0]?.createdAt ?? null,
      })),
    };
  }

  async updateTeacher(adminId: string, id: string, dto: UpdateTeacherDto) {
    await this.requireTeacher(id);
    if (dto.name === undefined && dto.email === undefined)
      return this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: teacherSelect,
      });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const teacher = await tx.user.update({
          where: { id },
          data: { name: dto.name, email: dto.email },
          select: teacherSelect,
        });
        await tx.adminAuditLog.create({
          data: { adminId, targetUserId: id, action: 'TEACHER_UPDATED' },
        });
        return teacher;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new AppError('EMAIL_IN_USE', 409, 'Email is already registered');
      throw error;
    }
  }

  async updateStatus(adminId: string, id: string, dto: UpdateTeacherStatusDto) {
    const current = await this.requireTeacher(id);
    if (current.isDisabled === dto.isDisabled) return current;
    const teacher = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isDisabled: dto.isDisabled },
        select: teacherSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: id,
          action: dto.isDisabled ? 'TEACHER_DISABLED' : 'TEACHER_ENABLED',
        },
      });
      return updated;
    });
    if (dto.isDisabled) this.roomsGateway.disconnectHost(id);
    return teacher;
  }

  private async requireTeacher(id: string) {
    const teacher = await this.prisma.user.findFirst({
      where: { id, role: Role.HOST },
      select: teacherSelect,
    });
    if (!teacher)
      throw new AppError('TEACHER_NOT_FOUND', 404, 'Teacher not found');
    return teacher;
  }
}
