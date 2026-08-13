import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma, RoomPhase, RoomStatus } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { competitionRanks } from './ranking';
import { pointsForAnswer } from './scoring';
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(quizId: string, hostId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ownerId: hostId },
      include: { _count: { select: { questions: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (!quiz._count.questions)
      throw new ConflictException('Quiz needs at least one question');
    for (let i = 0; i < 5; i++) {
      try {
        return await this.prisma.room.create({
          data: { quizId, hostId, code: this.code() },
        });
      } catch (e) {
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== 'P2002'
        )
          throw e;
      }
    }
    throw new ConflictException('Could not allocate room code');
  }
  async join(code: string, displayName: string) {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room || room.status === RoomStatus.FINISHED)
      throw new NotFoundException('Room not found or closed');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const participant = await tx.participant.create({
          data: { roomId: room.id, displayName },
        });
        const attempt = await tx.quizAttempt.create({
          data: { roomId: room.id, participantId: participant.id },
        });
        return {
          participantId: participant.id,
          participantToken: participant.accessToken,
          attemptId: attempt.id,
          roomCode: room.code,
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('That display name is already in use');
      throw e;
    }
  }
  async state(code: string, participantId?: string, participantToken?: string) {
    const room = await this.room(code);
    if (
      (participantId || participantToken) &&
      (!participantId ||
        !participantToken ||
        !(await this.prisma.participant.findFirst({
          where: {
            id: participantId,
            roomId: room.id,
            accessToken: participantToken,
          },
        })))
    )
      throw new AppError(
        'PARTICIPANT_NOT_FOUND',
        403,
        'Participant is not in this room',
      );
    const question = room.quiz.questions[room.currentQuestionIndex];
    return {
      code: room.code,
      status: room.status,
      phase: room.phase,
      question:
        room.phase !== RoomPhase.WAITING && question
          ? {
              id: question.id,
              text: question.text,
              position: room.currentQuestionIndex + 1,
              total: room.quiz.questions.length,
              choices: question.choices.map(({ id, text }) => ({ id, text })),
            }
          : null,
      answerSubmitted: participantId
        ? Boolean(
            await this.prisma.answer.findFirst({
              where: {
                attempt: { participantId, roomId: room.id },
                questionId: question?.id,
              },
            }),
          )
        : false,
    };
  }
  async start(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (room.status !== RoomStatus.LOBBY || room.phase !== RoomPhase.WAITING)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Room cannot be started');
    return this.prisma.room.update({
      where: { id: room.id },
      data: {
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.ACTIVE,
        currentQuestionIndex: 0,
      },
    });
  }
  async reveal(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (room.status !== RoomStatus.ACTIVE || room.phase !== RoomPhase.ACTIVE)
      throw new AppError(
        'INVALID_ROOM_PHASE',
        409,
        'Question cannot be revealed',
      );
    const question = room.quiz.questions[room.currentQuestionIndex];
    if (!question)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'No active question');
    return {
      room: await this.prisma.room.update({
        where: { id: room.id },
        data: { phase: RoomPhase.REVEALED },
      }),
      correctChoiceId:
        question.choices.find((choice) => choice.isCorrect)?.id ?? null,
    };
  }
  async next(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (room.status !== RoomStatus.ACTIVE || room.phase !== RoomPhase.REVEALED)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Question cannot advance');
    const next = room.currentQuestionIndex + 1;
    return this.prisma.room.update({
      where: { id: room.id },
      data:
        next >= room.quiz.questions.length
          ? { status: RoomStatus.FINISHED, phase: RoomPhase.COMPLETED }
          : { currentQuestionIndex: next, phase: RoomPhase.ACTIVE },
    });
  }
  async complete(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (
      room.status !== RoomStatus.ACTIVE ||
      (room.phase !== RoomPhase.ACTIVE && room.phase !== RoomPhase.REVEALED)
    )
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Room cannot be completed');
    return this.prisma.room.update({
      where: { id: room.id },
      data: { status: RoomStatus.FINISHED, phase: RoomPhase.COMPLETED },
    });
  }
  async submit(
    code: string,
    participantId: string,
    participantToken: string,
    choiceId: string,
  ) {
    const room = await this.room(code);
    if (room.status !== RoomStatus.ACTIVE || room.phase !== RoomPhase.ACTIVE)
      throw new AppError(
        'INVALID_ROOM_PHASE',
        409,
        'Room is not accepting answers',
      );
    const question = room.quiz.questions[room.currentQuestionIndex];
    if (!question)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'No active question');
    const choice = question.choices.find((item) => item.id === choiceId);
    if (!choice)
      throw new AppError(
        'FORBIDDEN',
        403,
        'Choice does not belong to the active question',
      );
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        roomId: room.id,
        participantId,
        participant: { accessToken: participantToken },
      },
    });
    if (!attempt)
      throw new AppError(
        'PARTICIPANT_NOT_FOUND',
        403,
        'Participant is not in this room',
      );
    try {
      await this.prisma.$transaction([
        this.prisma.answer.create({
          data: {
            attemptId: attempt.id,
            questionId: question.id,
            choiceId,
            isCorrect: choice.isCorrect,
          },
        }),
        this.prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { score: { increment: pointsForAnswer(choice.isCorrect) } },
        }),
      ]);
      return { correct: choice.isCorrect };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new AppError('ALREADY_ANSWERED', 409, 'Answer already submitted');
      throw e;
    }
  }
  async result(code: string, participantId?: string) {
    const room = await this.room(code);
    const leaderboard = await this.prisma.quizAttempt.findMany({
      where: { roomId: room.id },
      include: { participant: true },
      orderBy: { score: 'desc' },
      take: 20,
    });
    return {
      status: room.status,
      phase: room.phase,
      leaderboard: competitionRanks(
        leaderboard,
        (attempt) => attempt.score,
      ).map(({ item: attempt, rank }) => ({
        rank,
        displayName: attempt.participant.displayName,
        score: attempt.score,
        isYou: attempt.participantId === participantId,
      })),
    };
  }
  async socketAccess(
    code: string,
    participantId?: string,
    participantToken?: string,
    userId?: string,
  ) {
    const room = await this.room(code);
    if (userId === room.hostId)
      return { code: room.code, roomId: room.id, role: 'host' as const };
    if (!participantId || !participantToken)
      throw new ForbiddenException('Join the room first');
    const participant = await this.prisma.participant.findFirst({
      where: {
        id: participantId,
        roomId: room.id,
        accessToken: participantToken,
      },
    });
    if (!participant)
      throw new ForbiddenException('Participant is not in this room');
    return {
      code: room.code,
      roomId: room.id,
      role: 'participant' as const,
      participantId: participant.id,
      displayName: participant.displayName,
    };
  }
  async progress(code: string) {
    const room = await this.room(code);
    const question = room.quiz.questions[room.currentQuestionIndex];
    return {
      submitted: question
        ? await this.prisma.answer.count({
            where: { questionId: question.id, attempt: { roomId: room.id } },
          })
        : 0,
      participants: await this.prisma.participant.count({
        where: { roomId: room.id },
      }),
    };
  }
  async dashboard(code: string, hostId: string) {
    await this.hostRoom(code, hostId);
    return this.dashboardState(code);
  }
  async dashboardState(code: string) {
    const room = await this.room(code);
    const question = room.quiz.questions[room.currentQuestionIndex];
    const participants = await this.prisma.participant.findMany({
      where: { roomId: room.id },
      orderBy: { joinedAt: 'asc' },
    });
    const answers = question
      ? await this.prisma.answer.findMany({
          where: { questionId: question.id, attempt: { roomId: room.id } },
          select: {
            choiceId: true,
            attempt: { select: { participantId: true } },
          },
        })
      : [];
    const answered = new Set(
      answers.map((answer) => answer.attempt.participantId),
    );
    return {
      roomId: room.id,
      state: await this.state(code),
      participants: participants.map((participant) => ({
        id: participant.id,
        name: participant.displayName,
        status: answered.has(participant.id) ? 'answered' : 'waiting',
      })),
      progress: {
        submitted: answers.length,
        participants: participants.length,
      },
      distribution:
        room.phase === RoomPhase.REVEALED || room.phase === RoomPhase.COMPLETED
          ? (question?.choices.map((choice) => ({
              id: choice.id,
              text: choice.text,
              count: answers.filter((answer) => answer.choiceId === choice.id)
                .length,
              isCorrect: choice.isCorrect,
            })) ?? [])
          : [],
      leaderboard: (await this.result(code)).leaderboard,
    };
  }
  private room(code: string) {
    return this.prisma.room
      .findUnique({
        where: { code },
        include: {
          quiz: {
            include: {
              questions: {
                include: { choices: true },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      })
      .then((room) => {
        if (!room) throw new AppError('ROOM_NOT_FOUND', 404, 'Room not found');
        return room;
      });
  }
  private async hostRoom(code: string, hostId: string) {
    const room = await this.room(code);
    if (room.hostId !== hostId) throw new ForbiddenException();
    return room;
  }
  private code() {
    return randomInt(100_000, 1_000_000).toString();
  }
}
