import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  ActivityType,
  Prisma,
  Role,
  RoomPhase,
  RoomStatus,
} from '@prisma/client';
import { AppError } from '../../common/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { competitionRanks } from './ranking';
import { pointsForAnswer } from './scoring';
import {
  activityLifecycle,
  hasUsablePrompts,
  promptRequirementError,
  roomActions,
} from './activity-lifecycle';

const LIVE_LEADERBOARD_LIMIT = 20;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(quizId: string, hostId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ownerId: hostId, deletedAt: null },
      include: { _count: { select: { questions: true } } },
    });
    if (!quiz) throw new AppError('QUIZ_NOT_FOUND', 404, 'Quiz not found');
    if (!hasUsablePrompts(quiz.type, quiz._count.questions)) {
      const error = promptRequirementError(quiz.type);
      throw new AppError(error.code, 409, error.message);
    }
    for (let i = 0; i < 5; i++) {
      try {
        return await this.prisma.room.create({
          data: {
            quizId,
            hostId,
            code: this.code(),
            activityTitle: quiz.title,
            activityType: quiz.type,
          },
        });
      } catch (e) {
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== 'P2002'
        )
          throw e;
      }
    }
    throw new AppError('REQUEST_FAILED', 503, 'Could not allocate room code');
  }
  async join(code: string, displayName: string) {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room || room.status === RoomStatus.FINISHED)
      throw new AppError('ROOM_NOT_FOUND', 404, 'Room not found or closed');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const participant = await tx.participant.create({
          data: { roomId: room.id, displayName: displayName.trim() },
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
        throw new AppError(
          'DISPLAY_NAME_IN_USE',
          409,
          'That display name is already in use',
        );
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
    const lifecycle = activityLifecycle(room.quiz.type);
    const actions = roomActions(room.quiz.type, room.status, room.phase);
    const entries =
      question && lifecycle.canSubmitWord
        ? await this.wordCloudEntries(room.id, question.id, participantId)
        : [];
    const selectedAnswer =
      participantId && question && lifecycle.canSubmitChoice
        ? await this.prisma.answer.findFirst({
            where: {
              attempt: { participantId, roomId: room.id },
              questionId: question.id,
            },
            select: { choiceId: true },
          })
        : null;
    const wordSubmitted = Boolean(
      participantId && question && lifecycle.canSubmitWord
        ? ((await this.prisma.wordCloudEntry.findFirst({
            where: { roomId: room.id, questionId: question.id, participantId },
            select: { id: true },
          })) ??
            (await this.prisma.wordCloudVote.findFirst({
              where: {
                participantId,
                entry: { roomId: room.id, questionId: question.id },
              },
              select: { id: true },
            })))
        : null,
    );
    const revealsCorrectChoice =
      lifecycle.requiresCorrectChoice &&
      (room.phase === RoomPhase.REVEALED || room.phase === RoomPhase.COMPLETED);
    return {
      code: room.code,
      status: room.status,
      phase: room.phase,
      activityType: room.quiz.type,
      actions,
      question:
        room.phase !== RoomPhase.WAITING && question
          ? {
              id: question.id,
              text: question.text,
              position: room.currentQuestionIndex + 1,
              total: room.quiz.questions.length,
              choices: question.choices.map(({ id, text }) => ({ id, text })),
              entries,
              totalVotes: entries.reduce(
                (total, entry) => total + entry.votes,
                0,
              ),
            }
          : null,
      answerSubmitted: Boolean(selectedAnswer),
      selectedChoiceId: selectedAnswer?.choiceId ?? null,
      wordSubmitted,
      ...(revealsCorrectChoice
        ? {
            correctChoiceId:
              question?.choices.find((choice) => choice.isCorrect)?.id ?? null,
          }
        : {}),
    };
  }
  async start(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (!roomActions(room.quiz.type, room.status, room.phase).canStart)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Room cannot be started');
    return this.prisma.room.update({
      where: { id: room.id },
      data: {
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.ACTIVE,
        currentQuestionIndex: 0,
        startedAt: new Date(),
      },
    });
  }
  async reveal(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (!activityLifecycle(room.quiz.type).canReveal)
      throw new AppError(
        'INVALID_ACTIVITY_ACTION',
        409,
        'This activity cannot reveal an answer',
      );
    if (!roomActions(room.quiz.type, room.status, room.phase).canReveal)
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
      correctChoiceId: activityLifecycle(room.quiz.type).requiresCorrectChoice
        ? (question.choices.find((choice) => choice.isCorrect)?.id ?? null)
        : null,
    };
  }
  async next(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (!activityLifecycle(room.quiz.type).canAdvance)
      throw new AppError(
        'INVALID_ACTIVITY_ACTION',
        409,
        'This activity cannot advance to another question',
      );
    if (!roomActions(room.quiz.type, room.status, room.phase).canAdvance)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Question cannot advance');
    const next = room.currentQuestionIndex + 1;
    return this.prisma.room.update({
      where: { id: room.id },
      data:
        next >= room.quiz.questions.length
          ? {
              status: RoomStatus.FINISHED,
              phase: RoomPhase.COMPLETED,
              endedAt: new Date(),
            }
          : { currentQuestionIndex: next, phase: RoomPhase.ACTIVE },
    });
  }
  async complete(code: string, hostId: string) {
    const room = await this.hostRoom(code, hostId);
    if (!roomActions(room.quiz.type, room.status, room.phase).canComplete)
      throw new AppError('INVALID_ROOM_PHASE', 409, 'Room cannot be completed');
    return this.prisma.room.update({
      where: { id: room.id },
      data: {
        status: RoomStatus.FINISHED,
        phase: RoomPhase.COMPLETED,
        endedAt: new Date(),
      },
    });
  }
  async submit(
    code: string,
    participantId: string,
    participantToken: string,
    choiceId: string,
  ) {
    const room = await this.room(code);
    if (!activityLifecycle(room.quiz.type).canSubmitChoice)
      throw new AppError(
        'INVALID_ACTIVITY_ACTION',
        409,
        'This activity is not accepting choice answers',
      );
    if (!roomActions(room.quiz.type, room.status, room.phase).canSubmitChoice)
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
            isCorrect:
              activityLifecycle(room.quiz.type).scoresAnswers &&
              choice.isCorrect,
          },
        }),
        this.prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: {
            score: {
              increment: pointsForAnswer(
                activityLifecycle(room.quiz.type).scoresAnswers &&
                  choice.isCorrect,
              ),
            },
          },
        }),
      ]);
      return { accepted: true };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new AppError('ALREADY_ANSWERED', 409, 'Answer already submitted');
      throw e;
    }
  }
  async submitWord(
    code: string,
    participantId: string,
    participantToken: string,
    text: string,
  ) {
    const room = await this.room(code);
    if (!activityLifecycle(room.quiz.type).canSubmitWord)
      throw new AppError(
        'INVALID_ACTIVITY_ACTION',
        409,
        'Room is not accepting entries',
      );
    if (!roomActions(room.quiz.type, room.status, room.phase).canSubmitWord)
      throw new AppError(
        'INVALID_ROOM_PHASE',
        409,
        'Room is not accepting entries',
      );
    const question = room.quiz.questions[room.currentQuestionIndex];
    const display = text.trim().replace(/\s+/g, ' ');
    if (!question || !display || display.length > 30)
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid word cloud entry');
    await this.participantAttempt(room.id, participantId, participantToken);
    const normalizedText = display.replace(/[A-Z]/g, (letter) =>
      letter.toLowerCase(),
    );
    if (
      (await this.prisma.wordCloudEntry.findFirst({
        where: { roomId: room.id, questionId: question.id, participantId },
        select: { id: true },
      })) ??
      (await this.prisma.wordCloudVote.findFirst({
        where: {
          participantId,
          entry: { roomId: room.id, questionId: question.id },
        },
        select: { id: true },
      }))
    )
      throw new AppError(
        'WORD_ALREADY_SUBMITTED',
        409,
        'Word cloud response already submitted',
      );
    const existing = await this.prisma.wordCloudEntry.findFirst({
      where: { roomId: room.id, questionId: question.id, normalizedText },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.wordCloudVote.create({
        data: { entryId: existing.id, participantId },
      });
      return this.wordCloudEntries(room.id, question.id, participantId);
    }
    try {
      await this.prisma.wordCloudEntry.create({
        data: {
          roomId: room.id,
          questionId: question.id,
          participantId,
          text: display,
          normalizedText,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.wordCloudEntry.findFirst({
          where: { roomId: room.id, questionId: question.id, normalizedText },
          select: { id: true },
        });
        if (existing) {
          await this.prisma.wordCloudVote.create({
            data: { entryId: existing.id, participantId },
          });
          return this.wordCloudEntries(room.id, question.id, participantId);
        }
        if (
          await this.prisma.wordCloudEntry.findFirst({
            where: { roomId: room.id, questionId: question.id, participantId },
            select: { id: true },
          })
        )
          throw new AppError(
            'WORD_ALREADY_SUBMITTED',
            409,
            'Word cloud response already submitted',
          );
        throw new AppError('DUPLICATE_ENTRY', 409, 'That entry already exists');
      }
      throw error;
    }
    return this.wordCloudEntries(room.id, question.id, participantId);
  }
  async voteWord(
    code: string,
    participantId: string,
    participantToken: string,
    entryId: string,
  ) {
    const room = await this.room(code);
    const question = room.quiz.questions[room.currentQuestionIndex];
    if (!activityLifecycle(room.quiz.type).canSubmitWord)
      throw new AppError(
        'INVALID_ACTIVITY_ACTION',
        409,
        'Room is not accepting votes',
      );
    if (
      !roomActions(room.quiz.type, room.status, room.phase).canSubmitWord ||
      !question
    )
      throw new AppError(
        'INVALID_ROOM_PHASE',
        409,
        'Room is not accepting votes',
      );
    await this.participantAttempt(room.id, participantId, participantToken);
    const entry = await this.prisma.wordCloudEntry.findFirst({
      where: { id: entryId, roomId: room.id, questionId: question.id },
      select: { id: true, participantId: true },
    });
    if (!entry || entry.participantId === participantId)
      throw new AppError('FORBIDDEN', 403, 'Entry cannot be voted for');
    await this.prisma.$transaction(async (prisma) => {
      await prisma.wordCloudVote.deleteMany({
        where: {
          participantId,
          entry: { roomId: room.id, questionId: question.id },
        },
      });
      await prisma.wordCloudVote.create({ data: { entryId, participantId } });
    });
    return this.wordCloudEntries(room.id, question.id, participantId);
  }
  async result(code: string, participantId?: string) {
    const room = await this.room(code);
    if (!activityLifecycle(room.quiz.type).scoresAnswers) {
      const question = room.quiz.questions[room.currentQuestionIndex];
      const visiblePoll =
        room.quiz.type === ActivityType.POLL &&
        question &&
        (room.phase === RoomPhase.REVEALED ||
          room.phase === RoomPhase.COMPLETED);
      const answerCounts = visiblePoll
        ? await this.prisma.answer.groupBy({
            by: ['choiceId'],
            where: { questionId: question.id, attempt: { roomId: room.id } },
            _count: { _all: true },
          })
        : [];
      const countByChoice = new Map(
        answerCounts.map((answer) => [answer.choiceId, answer._count._all]),
      );
      return {
        status: room.status,
        phase: room.phase,
        activityType: room.quiz.type,
        leaderboard: [],
        poll: visiblePoll
          ? {
              questionId: question.id,
              text: question.text,
              responseCount: answerCounts.reduce(
                (total, answer) => total + answer._count._all,
                0,
              ),
              distribution: question.choices.map((choice) => ({
                id: choice.id,
                text: choice.text,
                count: countByChoice.get(choice.id) ?? 0,
              })),
            }
          : null,
      };
    }
    const leaderboard = await this.prisma.quizAttempt.findMany({
      where: { roomId: room.id },
      include: { participant: true },
      orderBy: { score: 'desc' },
      take: LIVE_LEADERBOARD_LIMIT,
    });
    const rankedLeaderboard = competitionRanks(
      leaderboard,
      (attempt) => attempt.score,
    ).map(({ item: attempt, rank }) => ({
      rank,
      displayName: attempt.participant.displayName,
      score: attempt.score,
      isYou: attempt.participantId === participantId,
    }));
    if (participantId && !rankedLeaderboard.some((entry) => entry.isYou)) {
      const ownAttempt = await this.prisma.quizAttempt.findUnique({
        where: {
          roomId_participantId: { roomId: room.id, participantId },
        },
        include: { participant: true },
      });
      if (ownAttempt)
        rankedLeaderboard.push({
          rank:
            (await this.prisma.quizAttempt.count({
              where: { roomId: room.id, score: { gt: ownAttempt.score } },
            })) + 1,
          displayName: ownAttempt.participant.displayName,
          score: ownAttempt.score,
          isYou: true,
        });
    }
    return {
      status: room.status,
      phase: room.phase,
      leaderboard: rankedLeaderboard,
    };
  }
  async participantResult(
    code: string,
    participantId?: string,
    participantToken?: string,
  ) {
    const room = await this.room(code);
    if (!participantId || !participantToken)
      throw new AppError(
        'PARTICIPANT_NOT_FOUND',
        403,
        'Participant is not in this room',
      );
    await this.participantAttempt(room.id, participantId, participantToken);
    if (
      activityLifecycle(room.quiz.type).canSubmitChoice &&
      room.phase !== RoomPhase.REVEALED &&
      room.phase !== RoomPhase.COMPLETED
    )
      throw new AppError(
        'INVALID_ROOM_PHASE',
        409,
        'Results are available after the question is revealed',
      );
    return this.result(code, participantId);
  }
  async socketAccess(
    code: string,
    participantId?: string,
    participantToken?: string,
    userId?: string,
  ) {
    const room = await this.room(code);
    if (userId === room.hostId) {
      const host = await this.prisma.user.findFirst({
        where: {
          id: userId,
          isDisabled: false,
          role: { in: [Role.HOST, Role.ADMIN] },
        },
        select: { id: true },
      });
      if (!host) throw new ForbiddenException('Host access is disabled');
      return { code: room.code, roomId: room.id, role: 'host' as const };
    }
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
    const lifecycle = activityLifecycle(room.quiz.type);
    const answers =
      question && lifecycle.canSubmitChoice
        ? await this.prisma.answer.findMany({
            where: { questionId: question.id, attempt: { roomId: room.id } },
            select: {
              choiceId: true,
              attempt: { select: { participantId: true } },
            },
          })
        : [];
    const wordResponders =
      question && lifecycle.canSubmitWord
        ? await this.prisma.wordCloudEntry.groupBy({
            by: ['participantId'],
            where: {
              roomId: room.id,
              questionId: question.id,
              participantId: { not: null },
            },
          })
        : [];
    const wordVoteResponders =
      question && lifecycle.canSubmitWord
        ? await this.prisma.wordCloudVote.groupBy({
            by: ['participantId'],
            where: {
              entry: { roomId: room.id, questionId: question.id },
            },
          })
        : [];
    const answered = new Set(
      lifecycle.canSubmitWord
        ? [
            ...wordResponders.flatMap(({ participantId }) =>
              participantId ? [participantId] : [],
            ),
            ...wordVoteResponders.map(({ participantId }) => participantId),
          ]
        : answers.map((answer) => answer.attempt.participantId),
    );
    const entries =
      question && lifecycle.canSubmitWord
        ? await this.wordCloudEntries(room.id, question.id)
        : [];
    return {
      roomId: room.id,
      state: await this.state(code),
      participants: participants.map((participant) => ({
        id: participant.id,
        name: participant.displayName,
        status: answered.has(participant.id) ? 'answered' : 'waiting',
      })),
      progress: {
        submitted: answered.size,
        participants: participants.length,
      },
      distribution:
        room.phase === RoomPhase.REVEALED || room.phase === RoomPhase.COMPLETED
          ? (question?.choices.map((choice) => ({
              id: choice.id,
              text: choice.text,
              count: answers.filter((answer) => answer.choiceId === choice.id)
                .length,
              isCorrect: lifecycle.scoresAnswers && choice.isCorrect,
            })) ?? [])
          : [],
      entries,
      leaderboard: (await this.result(code)).leaderboard,
    };
  }
  private async participantAttempt(
    roomId: string,
    participantId: string,
    participantToken: string,
  ) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        roomId,
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
    return attempt;
  }
  private async wordCloudEntries(
    roomId: string,
    questionId: string,
    participantId?: string,
  ) {
    const entries = await this.prisma.wordCloudEntry.findMany({
      where: { roomId, questionId },
      include: {
        _count: { select: { votes: true } },
        votes: participantId
          ? { where: { participantId }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: 'asc' },
    });
    return entries
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        votes: entry._count.votes + 1,
        voted: participantId ? entry.votes.length > 0 : false,
        isOwn: entry.participantId === participantId,
      }))
      .sort((a, b) => b.votes - a.votes || a.text.localeCompare(b.text))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
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
