import { ActivityType, Role, RoomPhase, RoomStatus } from '@prisma/client';
import { RoomResultsService } from './room-results.service';
const room = {
  id: 'r1',
  code: 'ROOM1',
  hostId: 'host',
  status: RoomStatus.ACTIVE,
  phase: RoomPhase.ACTIVE,
  activityTitle: 'ไทย Quiz',
  activityType: ActivityType.QUIZ,
  createdAt: new Date('2026-08-22T00:00:00Z'),
  startedAt: new Date('2026-08-22T00:01:00Z'),
  endedAt: null,
  host: { id: 'host', name: 'Teacher', email: 'teacher@example.test' },
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
      participantId: 'a',
      score: 1000,
      participant: { displayName: 'A' },
      answers: [
        {
          questionId: 'q1',
          choiceId: 'c1',
          isCorrect: true,
          choice: { text: 'Correct' },
          question: { text: 'Question' },
          submittedAt: new Date('2026-08-22T00:02:00Z'),
        },
      ],
    },
    {
      participantId: 'b',
      score: 1000,
      participant: { displayName: 'B' },
      answers: [
        {
          questionId: 'q1',
          choiceId: 'c2',
          isCorrect: false,
          choice: { text: 'Wrong' },
          question: { text: 'Question' },
          submittedAt: new Date('2026-08-22T00:02:00Z'),
        },
      ],
    },
    {
      participantId: 'c',
      score: 0,
      participant: { displayName: 'C' },
      answers: [],
    },
  ],
  wordCloudEntries: [],
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

  it('rejects another teacher but allows an admin to inspect history', async () => {
    const service = new RoomResultsService({
      room: { findUnique: jest.fn().mockResolvedValue(room) },
    } as never);
    await expect(
      service.results('ROOM1', 'other-teacher'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.results('ROOM1', {
        sub: 'admin',
        email: 'admin@example.test',
        role: Role.ADMIN,
      }),
    ).resolves.toMatchObject({ room: { id: 'r1' } });
  });
});
