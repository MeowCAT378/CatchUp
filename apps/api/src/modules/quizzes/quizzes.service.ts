import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateQuestionDto,
  CreateQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
} from './dto';
@Injectable()
export class QuizzesService {
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
    return this.prisma.quiz.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type ?? ActivityType.QUIZ,
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
  async remove(id: string, ownerId: string) {
    await this.owned(id, ownerId);
    return this.prisma.quiz.delete({ where: { id } });
  }
  async addQuestion(quizId: string, ownerId: string, dto: CreateQuestionDto) {
    const quiz = await this.owned(quizId, ownerId);
    this.validateQuestion(quiz.type, dto);
    const position = await this.prisma.question.count({ where: { quizId } });
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
      include: { quiz: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.quiz.ownerId !== ownerId) throw new ForbiddenException();
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
      include: { quiz: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (question.quiz.ownerId !== ownerId) throw new ForbiddenException();
    return this.prisma.question.delete({ where: { id } });
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
    if (type === ActivityType.WORD_CLOUD) {
      if (choices.length)
        throw new AppError('VALIDATION_ERROR', 400, 'Word clouds do not use choices');
      return;
    }
    if (choices.length < 2)
      throw new AppError('VALIDATION_ERROR', 400, 'Questions need at least two choices');
    if (type === ActivityType.QUIZ && choices.filter((choice) => choice.isCorrect).length !== 1)
      throw new AppError('VALIDATION_ERROR', 400, 'Quizzes need exactly one correct choice');
  }
}
