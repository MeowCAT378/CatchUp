import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import {
  activityLifecycle,
  canConfigurePrompt,
} from '../rooms/activity-lifecycle';
import {
  CreateQuestionDto,
  CreateQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
} from './dto';
@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);
  constructor(private readonly prisma: PrismaService) {}
  list(ownerId: string) {
    return this.prisma.quiz.findMany({
      where: { ownerId },
      include: { _count: { select: { questions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async one(id: string, ownerId: string) {
    return this.owned(id, ownerId, {
      questions: { include: { choices: true }, orderBy: { position: 'asc' } },
    });
  }
  create(ownerId: string, dto: CreateQuizDto) {
    if (!canConfigurePrompt(dto.type, dto.questions?.length ?? 0))
      throw new AppError(
        'WORD_CLOUD_PROMPT_ALREADY_CONFIGURED',
        400,
        'Word clouds have exactly one prompt',
      );
    dto.questions?.forEach((question) =>
      this.validateQuestion(dto.type, question),
    );
    return this.prisma.quiz.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        ownerId,
        questions: dto.questions
          ? {
              create: dto.questions.map((q, position) => ({
                text: q.text,
                position,
                choices: { create: q.choices ?? [] },
              })),
            }
          : undefined,
      },
      include: { questions: { include: { choices: true } } },
    });
  }
  async update(id: string, ownerId: string, dto: UpdateQuizDto) {
    await this.owned(id, ownerId);
    return this.prisma.quiz.update({
      where: { id },
      data: { title: dto.title, description: dto.description },
    });
  }
  async duplicate(id: string, ownerId: string, title?: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          include: { choices: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!quiz) throw new AppError('QUIZ_NOT_FOUND', 404, 'Quiz not found');
    if (quiz.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.quiz.create({
      data: {
        title: title?.trim() || `${quiz.title} (copy)`,
        description: quiz.description,
        type: quiz.type,
        ownerId,
        questions: {
          create: quiz.questions.map((question) => ({
            text: question.text,
            position: question.position,
            choices: {
              create: question.choices.map(({ text, isCorrect }) => ({
                text,
                isCorrect,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { choices: true } } },
    });
  }
  async remove(id: string, ownerId: string) {
    await this.owned(id, ownerId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rooms = await tx.room.findMany({
          where: { quizId: id },
          select: { id: true, code: true },
        });
        const roomIds = rooms.map((room) => room.id);
        const questions = await tx.question.findMany({
          where: { quizId: id },
          select: { id: true },
        });
        const questionIds = questions.map((question) => question.id);

        await tx.wordCloudVote.deleteMany({
          where: {
            OR: [
              { entry: { roomId: { in: roomIds } } },
              { entry: { questionId: { in: questionIds } } },
              { participant: { roomId: { in: roomIds } } },
            ],
          },
        });
        await tx.wordCloudEntry.deleteMany({
          where: {
            OR: [
              { roomId: { in: roomIds } },
              { questionId: { in: questionIds } },
            ],
          },
        });
        await tx.answer.deleteMany({
          where: {
            OR: [
              { attempt: { roomId: { in: roomIds } } },
              { questionId: { in: questionIds } },
            ],
          },
        });
        await tx.quizAttempt.deleteMany({ where: { roomId: { in: roomIds } } });
        await tx.participant.deleteMany({ where: { roomId: { in: roomIds } } });
        await tx.room.deleteMany({ where: { id: { in: roomIds } } });
        await tx.choice.deleteMany({
          where: { questionId: { in: questionIds } },
        });
        await tx.question.deleteMany({ where: { id: { in: questionIds } } });
        await tx.quiz.delete({ where: { id } });
        return { id, rooms };
      });
    } catch (error) {
      this.logger.error(`Quiz deletion failed: ${id}`, error);
      throw new AppError('DELETE_FAILED', 500, 'Could not delete activity');
    }
  }
  async addQuestion(quizId: string, ownerId: string, dto: CreateQuestionDto) {
    const quiz = await this.owned(quizId, ownerId);
    if (await this.prisma.room.count({ where: { quizId } }))
      throw new AppError(
        'ACTIVITY_IN_USE',
        409,
        'Questions cannot be changed after a room is created',
      );
    this.validateQuestion(quiz.type, dto);
    const position = await this.prisma.question.count({ where: { quizId } });
    if (!canConfigurePrompt(quiz.type, position))
      throw new AppError(
        'WORD_CLOUD_PROMPT_ALREADY_CONFIGURED',
        409,
        'Word clouds have exactly one prompt',
      );
    return this.prisma.question.create({
      data: {
        quizId,
        text: dto.text,
        position,
        choices: { create: dto.choices ?? [] },
      },
      include: { choices: true },
    });
  }
  async updateQuestion(id: string, ownerId: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        quiz: { include: { _count: { select: { rooms: true } } } },
      },
    });
    if (!question)
      throw new AppError('QUESTION_NOT_FOUND', 404, 'Question not found');
    if (question.quiz.ownerId !== ownerId) throw new ForbiddenException();
    if (question.quiz._count.rooms)
      throw new AppError(
        'ACTIVITY_IN_USE',
        409,
        'Questions cannot be changed after a room is created',
      );
    this.validateQuestion(question.quiz.type, dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.choice.deleteMany({ where: { questionId: id } });
      return tx.question.update({
        where: { id },
        data: { text: dto.text, choices: { create: dto.choices } },
        include: { choices: true },
      });
    });
  }
  async removeQuestion(id: string, ownerId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { quiz: { include: { _count: { select: { rooms: true } } } } },
    });
    if (!question)
      throw new AppError('QUESTION_NOT_FOUND', 404, 'Question not found');
    if (question.quiz.ownerId !== ownerId) throw new ForbiddenException();
    if (
      question.quiz.type &&
      activityLifecycle(question.quiz.type).maxPrompts === 1 &&
      question.quiz._count?.rooms
    )
      throw new AppError(
        'ACTIVITY_IN_USE',
        409,
        'Word cloud prompts cannot be changed after a room is created',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id } });
      const remaining = await tx.question.findMany({
        where: { quizId: question.quizId, position: { gt: question.position } },
        orderBy: { position: 'asc' },
      });
      for (const item of remaining)
        await tx.question.update({
          where: { id: item.id },
          data: { position: item.position - 1 },
        });
      return { id };
    });
  }
  private async owned(
    id: string,
    ownerId: string,
    include?: Record<string, unknown>,
  ) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include });
    if (!quiz) throw new AppError('QUIZ_NOT_FOUND', 404, 'Quiz not found');
    if (quiz.ownerId !== ownerId) throw new ForbiddenException();
    return quiz;
  }
  private validateQuestion(type: ActivityType, dto: CreateQuestionDto) {
    const choices = dto.choices ?? [];
    const lifecycle = activityLifecycle(type);
    if (!lifecycle.usesChoices) {
      if (choices.length)
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          'Word clouds do not use choices',
        );
      return;
    }
    if (choices.length < 2)
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'Questions need at least two choices',
      );
    if (
      lifecycle.requiresCorrectChoice &&
      choices.filter((choice) => choice.isCorrect).length !== 1
    )
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        'Quizzes need exactly one correct choice',
      );
  }
}
