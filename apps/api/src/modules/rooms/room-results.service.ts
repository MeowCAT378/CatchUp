import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, Prisma, Role, RoomPhase } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { competitionRanks } from './ranking';
import { pointsForAnswer } from './scoring';

const resultInclude = {
  host: { select: { id: true, name: true, email: true } },
  quiz: {
    include: {
      questions: {
        include: { choices: true },
        orderBy: { position: 'asc' as const },
      },
    },
  },
  attempts: {
    include: {
      participant: true,
      answers: { include: { choice: true, question: true } },
    },
  },
  wordCloudEntries: {
    include: {
      _count: { select: { votes: true } },
      votes: { select: { participantId: true } },
    },
  },
} satisfies Prisma.RoomInclude;

@Injectable()
export class RoomResultsService {
  constructor(private readonly prisma: PrismaService) {}

  results(code: string, viewer: AuthUser | string) {
    return this.load({ code }, viewer);
  }

  resultsById(id: string, viewer: AuthUser | string) {
    return this.load({ id }, viewer);
  }

  private async load(
    where: Prisma.RoomWhereUniqueInput,
    viewer: AuthUser | string,
  ) {
    const room = await this.prisma.room.findUnique({
      where,
      include: resultInclude,
    });
    if (!room) throw new NotFoundException('Room not found');
    const viewerId = typeof viewer === 'string' ? viewer : viewer.sub;
    const viewerRole = typeof viewer === 'string' ? Role.HOST : viewer.role;
    if (viewerRole !== Role.ADMIN && room.hostId !== viewerId)
      throw new ForbiddenException();
    const activityType = room.activityType ?? room.quiz.type;
    const attempts = [...room.attempts].sort((a, b) => b.score - a.score);
    const allAnswers = attempts.flatMap((attempt) =>
      attempt.answers.map((answer) => ({ ...answer, attempt })),
    );
    const wordResponders = new Set(
      room.wordCloudEntries.flatMap((entry) => [
        ...(entry.participantId ? [entry.participantId] : []),
        ...entry.votes.map((vote) => vote.participantId),
      ]),
    );
    const totalParticipants = attempts.length;
    const scores = attempts.map((attempt) => attempt.score);
    const isQuiz = activityType === ActivityType.QUIZ;
    const isWordCloud = activityType === ActivityType.WORD_CLOUD;
    const answersAllowed =
      room.phase === RoomPhase.REVEALED || room.phase === RoomPhase.COMPLETED;
    const questions = room.quiz.questions.map((question) => {
      const answers = allAnswers.filter(
        (answer) => answer.questionId === question.id,
      );
      const entries = room.wordCloudEntries
        .filter((entry) => entry.questionId === question.id)
        .sort(
          (a, b) =>
            b._count.votes - a._count.votes || a.text.localeCompare(b.text),
        );
      const responseCount = isWordCloud
        ? entries.reduce((total, entry) => total + entry._count.votes + 1, 0)
        : answers.length;
      const correct = isQuiz
        ? answers.filter((answer) => answer.isCorrect).length
        : 0;
      return {
        id: question.id,
        text: question.text,
        responseCount,
        correctCount: correct,
        incorrectCount: isQuiz ? answers.length - correct : 0,
        unansweredCount: Math.max(0, totalParticipants - responseCount),
        correctPercentage:
          isQuiz && answers.length
            ? Math.round((correct / answers.length) * 100)
            : 0,
        correctChoiceId:
          answersAllowed && isQuiz
            ? (question.choices.find((choice) => choice.isCorrect)?.id ?? null)
            : null,
        distribution: question.choices.map((choice) => ({
          choiceId: choice.id,
          text: choice.text,
          count: answers.filter((answer) => answer.choiceId === choice.id)
            .length,
          isCorrect: answersAllowed && isQuiz ? choice.isCorrect : undefined,
        })),
        words: entries.map((entry) => ({
          text: entry.text,
          submissionCount: entry._count.votes + 1,
          voteCount: entry._count.votes,
        })),
      };
    });
    const responseCount = isWordCloud ? wordResponders.size : allAnswers.length;
    const questionCount = Math.max(questions.length, 1);
    return {
      room: {
        id: room.id,
        code: room.code,
        status: room.status,
        phase: room.phase,
        quizTitle: room.activityTitle ?? room.quiz.title,
        activityType,
        createdAt: room.createdAt,
        startedAt: room.startedAt,
        endedAt: room.endedAt,
        teacher: room.host,
      },
      summary: {
        totalParticipants,
        totalSubmittedAnswers: responseCount,
        completionRate: totalParticipants
          ? Math.round(
              (responseCount / (totalParticipants * questionCount)) * 100,
            )
          : 0,
        averageScore:
          isQuiz && totalParticipants
            ? Math.round(
                scores.reduce((sum, score) => sum + score, 0) /
                  totalParticipants,
              )
            : 0,
        highestScore: isQuiz ? (scores[0] ?? 0) : 0,
        lowestScore: isQuiz ? (scores.at(-1) ?? 0) : 0,
      },
      questions,
      participants: competitionRanks(attempts, (attempt) =>
        isQuiz ? attempt.score : 0,
      ).map(({ item: attempt, rank }) => {
        const answered = isWordCloud
          ? Number(wordResponders.has(attempt.participantId))
          : attempt.answers.length;
        const correct = isQuiz
          ? attempt.answers.filter((answer) => answer.isCorrect).length
          : 0;
        return {
          id: attempt.participantId,
          name: attempt.participant.displayName,
          score: attempt.score,
          rank,
          answeredCount: answered,
          correctCount: correct,
          incorrectCount: isQuiz ? answered - correct : 0,
        };
      }),
      responses: allAnswers.map((answer) => ({
        participant: answer.attempt.participant.displayName,
        question: answer.question.text,
        selectedAnswer: answer.choice.text,
        correctAnswer:
          answersAllowed && isQuiz
            ? (room.quiz.questions
                .find((question) => question.id === answer.questionId)
                ?.choices.find((choice) => choice.isCorrect)?.text ?? '')
            : '',
        correct: isQuiz ? answer.isCorrect : null,
        scoreAwarded: isQuiz && answer.isCorrect ? pointsForAnswer(true) : 0,
        submittedAt: answer.submittedAt,
      })),
    };
  }
}
