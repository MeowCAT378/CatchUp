import { ActivityType, Prisma, RoomPhase, RoomStatus } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { RoomsService } from './rooms.service';
const room = (
  phase: RoomPhase,
  status: RoomStatus = RoomStatus.ACTIVE,
  type: ActivityType = ActivityType.QUIZ,
) => ({
  id: 'r1',
  code: '123456',
  hostId: 'host',
  status,
  phase,
  currentQuestionIndex: 0,
  quiz: {
    type,
    questions: [
      { id: 'q1', text: 'Prompt', choices: [{ id: 'c1', isCorrect: true }] },
    ],
  },
});
const service = (value: ReturnType<typeof room>) =>
  new RoomsService({
    room: { findUnique: jest.fn().mockResolvedValue(value), update: jest.fn() },
    participant: { findFirst: jest.fn() },
    quizAttempt: { findFirst: jest.fn() },
    answer: { findFirst: jest.fn(), create: jest.fn() },
    wordCloudEntry: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  } as never);
describe('RoomsService state machine', () => {
  it.each([
    [RoomPhase.COMPLETED, RoomStatus.FINISHED],
    [RoomPhase.ACTIVE, RoomStatus.ACTIVE],
  ])('rejects invalid starts', async (phase, status) => {
    await expect(
      service(room(phase, status)).start('123456', 'host'),
    ).rejects.toMatchObject<AppError>({ code: 'INVALID_ROOM_PHASE' });
  });
  it('rejects reveal before active question and answers after reveal', async () => {
    await expect(
      service(room(RoomPhase.WAITING, RoomStatus.LOBBY)).reveal(
        '123456',
        'host',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_ROOM_PHASE' });
    await expect(
      service(room(RoomPhase.REVEALED)).submit('123456', 'p1', 'c1'),
    ).rejects.toMatchObject({ code: 'INVALID_ROOM_PHASE' });
  });
  it('rejects a stale participant id', async () => {
    const target = service(room(RoomPhase.ACTIVE));
    await expect(target.state('123456', 'stale')).rejects.toMatchObject({
      code: 'PARTICIPANT_NOT_FOUND',
    });
  });
  it('does not expose participant results without a valid room token', async () => {
    await expect(
      service(room(RoomPhase.COMPLETED, RoomStatus.FINISHED)).participantResult(
        '123456',
        'participant',
        'wrong-token',
      ),
    ).rejects.toMatchObject({ code: 'PARTICIPANT_NOT_FOUND' });
  });
  it('rejects another teacher controlling a room', async () => {
    await expect(
      service(room(RoomPhase.WAITING, RoomStatus.LOBBY)).start(
        '123456',
        'other-host',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('retries a colliding generated code', async () => {
    const codes: string[] = [];
    const duplicate = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const create = jest.fn(({ data }: { data: { code: string } }) => {
      codes.push(data.code);
      return codes.length === 1
        ? Promise.reject(duplicate)
        : Promise.resolve({ code: '654321' });
    });
    const target = new RoomsService({
      quiz: {
        findFirst: jest.fn().mockResolvedValue({
          type: ActivityType.QUIZ,
          _count: { questions: 1 },
        }),
      },
      room: { create },
    } as never);
    await expect(target.create('quiz', 'host')).resolves.toEqual({
      code: '654321',
    });
    expect(create).toHaveBeenCalledTimes(2);
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
  });
  it('returns persisted word-cloud votes as ranked final state', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue({
          ...room(RoomPhase.COMPLETED, RoomStatus.FINISHED),
          quiz: {
            type: ActivityType.WORD_CLOUD,
            questions: [{ id: 'q1', text: 'Prompt', choices: [] }],
          },
        }),
      },
      wordCloudEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b', text: 'Beta', _count: { votes: 1 }, votes: [] },
          { id: 'a', text: 'Alpha', _count: { votes: 3 }, votes: [] },
        ]),
      },
    } as never);
    const state = await target.state('123456');
    expect(state.question).toMatchObject({
      totalVotes: 4,
      entries: [
        { id: 'a', votes: 3, rank: 1 },
        { id: 'b', votes: 1, rank: 2 },
      ],
    });
  });
  it('opens a word cloud with one prompt but rejects a missing prompt', async () => {
    const create = jest.fn().mockResolvedValue({ code: '123456' });
    const target = new RoomsService({
      quiz: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            type: ActivityType.WORD_CLOUD,
            _count: { questions: 1 },
          })
          .mockResolvedValueOnce({
            type: ActivityType.WORD_CLOUD,
            _count: { questions: 0 },
          }),
      },
      room: { create },
    } as never);
    await expect(target.create('word-cloud', 'host')).resolves.toEqual({
      code: '123456',
    });
    await expect(
      target.create('empty-word-cloud', 'host'),
    ).rejects.toMatchObject({
      code: 'WORD_CLOUD_PROMPT_REQUIRED',
    });
  });
  it('uses the word-cloud waiting, active, completed lifecycle only', async () => {
    const update = jest
      .fn()
      .mockResolvedValueOnce({ phase: RoomPhase.ACTIVE })
      .mockResolvedValueOnce({ phase: RoomPhase.COMPLETED });
    const target = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.WAITING, RoomStatus.LOBBY, ActivityType.WORD_CLOUD),
          ),
        update,
      },
    } as never);
    await expect(target.start('123456', 'host')).resolves.toEqual({
      phase: RoomPhase.ACTIVE,
    });
    const active = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD),
          ),
        update,
      },
    } as never);
    await expect(active.complete('123456', 'host')).resolves.toEqual({
      phase: RoomPhase.COMPLETED,
    });
    await expect(active.next('123456', 'host')).rejects.toMatchObject({
      code: 'INVALID_ACTIVITY_ACTION',
    });
  });
  it('accepts a player word and returns the synchronized aggregation', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD),
          ),
      },
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }),
      },
      wordCloudEntry: {
        create: jest.fn().mockResolvedValue({ id: 'entry' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'entry', text: 'CatchUp', _count: { votes: 2 }, votes: [] },
          ]),
      },
    } as never);
    await expect(
      target.submitWord('123456', 'player', 'token', '  CatchUp  '),
    ).resolves.toEqual([
      expect.objectContaining({ text: 'CatchUp', votes: 2, rank: 1 }),
    ]);
  });
});
