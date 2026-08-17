import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, RoomPhase } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { competitionRanks } from './ranking';
@Injectable()
export class RoomResultsService {
  constructor(private readonly prisma: PrismaService) {}
  async results(code: string, hostId: string) {
    const room = await this.prisma.room.findUnique({
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
        attempts: { include: { participant: true, answers: true } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== hostId) throw new ForbiddenException();
    const attempts = [...room.attempts].sort((a, b) => b.score - a.score);
    const allAnswers = attempts.flatMap((attempt) => attempt.answers);
    const totalParticipants = attempts.length;
    const scores = attempts.map((attempt) => attempt.score);
    const isQuiz = room.quiz.type === ActivityType.QUIZ;
    const answersAllowed =
      room.phase === RoomPhase.REVEALED || room.phase === RoomPhase.COMPLETED;
    const questions = room.quiz.questions.map((question) => {
      const answers = allAnswers.filter(
        (answer) => answer.questionId === question.id,
      );
      const correct = isQuiz
        ? answers.filter((answer) => answer.isCorrect).length
        : 0;
      return {
        id: question.id,
        text: question.text,
        responseCount: answers.length,
        correctCount: correct,
        incorrectCount: isQuiz ? answers.length - correct : 0,
        unansweredCount: totalParticipants - answers.length,
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
      };
    });
    return {
      room: {
        code: room.code,
        phase: room.phase,
        quizTitle: room.quiz.title,
        activityType: room.quiz.type,
      },
      summary: {
        totalParticipants,
        totalSubmittedAnswers: allAnswers.length,
        completionRate:
          totalParticipants && questions.length
            ? Math.round(
                (allAnswers.length / (totalParticipants * questions.length)) *
                  100,
              )
            : 0,
        averageScore: totalParticipants
          ? Math.round(
              scores.reduce((sum, score) => sum + score, 0) / totalParticipants,
            )
          : 0,
        highestScore: scores[0] ?? 0,
        lowestScore: scores.at(-1) ?? 0,
      },
      questions,
      participants: competitionRanks(attempts, (attempt) => attempt.score).map(
        ({ item: attempt, rank }) => {
          const answered = attempt.answers.length;
          const correct = isQuiz
            ? attempt.answers.filter((answer) => answer.isCorrect).length
            : 0;
          return {
            name: attempt.participant.displayName,
            score: attempt.score,
            rank,
            answeredCount: answered,
            correctCount: correct,
            incorrectCount: isQuiz ? answered - correct : 0,
          };
        },
      ),
    };
  }
}
