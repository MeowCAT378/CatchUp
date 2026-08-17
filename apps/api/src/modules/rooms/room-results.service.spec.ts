import { ActivityType, RoomPhase, RoomStatus } from '@prisma/client';
import { RoomResultsService } from './room-results.service';
const room = {
  id: 'r1',
  code: 'ROOM1',
  hostId: 'host',
  status: RoomStatus.ACTIVE,
  phase: RoomPhase.ACTIVE,
  quiz: {
    title: 'ไทย Quiz',
    type: ActivityType.QUIZ,
    questions: [
      {
        id: 'q1',
        text: 'Question',
        choices: [
          { id: 'c1', text: 'Correct', isCorrect: true },
          { id: 'c2', text: 'Wrong', isCorrect: false },
        ],
      },
    ],
  },
  attempts: [
    {
      score: 1000,
      participant: { displayName: 'A' },
      answers: [{ questionId: 'q1', choiceId: 'c1', isCorrect: true }],
    },
    {
      score: 1000,
      participant: { displayName: 'B' },
      answers: [{ questionId: 'q1', choiceId: 'c2', isCorrect: false }],
    },
    { score: 0, participant: { displayName: 'C' }, answers: [] },
  ],
};
describe('RoomResultsService', () => {
  it('calculates summary, competition ranks, and hides correct answers before reveal', async () => {
    const prisma = { room: { findUnique: jest.fn().mockResolvedValue(room) } };
    const results = await new RoomResultsService(prisma as never).results(
      'ROOM1',
      'host',
    );
    expect(results.summary).toMatchObject({
      totalParticipants: 3,
      totalSubmittedAnswers: 2,
      completionRate: 67,
      averageScore: 667,
      highestScore: 1000,
      lowestScore: 0,
    });
    expect(results.participants.map((p) => p.rank)).toEqual([1, 1, 3]);
    expect(results.questions[0]).toMatchObject({
      responseCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 1,
      correctPercentage: 50,
      correctChoiceId: null,
    });
    expect(results.questions[0].distribution[0].isCorrect).toBeUndefined();
  });
  it('reveals correct answers only in allowed phases', async () => {
    const prisma = {
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...room, phase: RoomPhase.REVEALED }),
      },
    };
    const results = await new RoomResultsService(prisma as never).results(
      'ROOM1',
      'host',
    );
    expect(results.questions[0].correctChoiceId).toBe('c1');
    expect(results.questions[0].distribution[0].isCorrect).toBe(true);
  });
});
