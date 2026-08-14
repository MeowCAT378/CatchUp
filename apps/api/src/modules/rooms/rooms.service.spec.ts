import { ActivityType, Prisma, RoomPhase, RoomStatus } from '@prisma/client';
import { AppError } from '../../common/app-error';
import { RoomsService } from './rooms.service';
const room = (phase: RoomPhase, status: RoomStatus = RoomStatus.ACTIVE) => ({
  id: 'r1',
  code: '123456',
  hostId: 'host',
  status,
  phase,
  currentQuestionIndex: 0,
  quiz: { questions: [{ id: 'q1', choices: [{ id: 'c1', isCorrect: true }] }] },
});
const service = (value: ReturnType<typeof room>) =>
  new RoomsService({
    room: { findUnique: jest.fn().mockResolvedValue(value), update: jest.fn() },
    participant: { findFirst: jest.fn() },
    quizAttempt: { findFirst: jest.fn() },
    answer: { findFirst: jest.fn(), create: jest.fn() },
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
  it('rejects another teacher controlling a room', async () => {
    await expect(
      service(room(RoomPhase.WAITING, RoomStatus.LOBBY)).start(
        '123456',
        'other-host',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('retries a colliding generated code', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValue({ code: '654321' });
    const target = new RoomsService({
      quiz: {
        findFirst: jest.fn().mockResolvedValue({ _count: { questions: 1 } }),
      },
      room: { create },
    } as never);
    await expect(target.create('quiz', 'host')).resolves.toEqual({
      code: '654321',
    });
    expect(create).toHaveBeenCalledTimes(2);
    for (const [{ data }] of create.mock.calls)
      expect(data.code).toMatch(/^\d{6}$/);
  });
  it('returns persisted word-cloud votes as ranked final state', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue({
          ...room(RoomPhase.COMPLETED, RoomStatus.FINISHED),
          quiz: { type: ActivityType.WORD_CLOUD, questions: [{ id: 'q1', text: 'Prompt', choices: [] }] },
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
});
