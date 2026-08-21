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
      service(room(RoomPhase.REVEALED)).submit('123456', 'p1', 'token', 'c1'),
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
  it.each([ActivityType.QUIZ, ActivityType.POLL])(
    'withholds active %s participant results',
    async (type) => {
      const target = new RoomsService({
        room: {
          findUnique: jest
            .fn()
            .mockResolvedValue(room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, type)),
        },
        quizAttempt: {
          findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }),
        },
      } as never);

      await expect(
        target.participantResult('123456', 'player', 'token'),
      ).rejects.toMatchObject({ code: 'INVALID_ROOM_PHASE', status: 409 });
    },
  );
  it.each([ActivityType.QUIZ, ActivityType.POLL])(
    'returns revealed %s participant results',
    async (type) => {
      const target = new RoomsService({
        room: {
          findUnique: jest
            .fn()
            .mockResolvedValue(
              room(RoomPhase.REVEALED, RoomStatus.ACTIVE, type),
            ),
        },
        quizAttempt: {
          findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue({
            participantId: 'player',
            score: 0,
            participant: { displayName: 'Player' },
          }),
          count: jest.fn().mockResolvedValue(0),
        },
        answer: { groupBy: jest.fn().mockResolvedValue([]) },
      } as never);

      await expect(
        target.participantResult('123456', 'player', 'token'),
      ).resolves.toMatchObject({ phase: RoomPhase.REVEALED });
    },
  );
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
      totalVotes: 6,
      entries: [
        { id: 'a', votes: 4, rank: 1 },
        { id: 'b', votes: 2, rank: 2 },
      ],
    });
  });
  it('returns participant selection without correctness before reveal', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue(room(RoomPhase.ACTIVE)),
      },
      participant: { findFirst: jest.fn().mockResolvedValue({ id: 'player' }) },
      answer: {
        findFirst: jest.fn().mockResolvedValue({ choiceId: 'c1' }),
      },
    } as never);

    const state = await target.state('123456', 'player', 'token');
    expect(state).toMatchObject({
      answerSubmitted: true,
      selectedChoiceId: 'c1',
    });
    expect(state).not.toHaveProperty('correctChoiceId');
  });
  it('returns correctness only after reveal', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue(room(RoomPhase.REVEALED)),
      },
      participant: { findFirst: jest.fn().mockResolvedValue({ id: 'player' }) },
      answer: {
        findFirst: jest.fn().mockResolvedValue({ choiceId: 'c1' }),
      },
    } as never);

    await expect(
      target.state('123456', 'player', 'token'),
    ).resolves.toMatchObject({
      selectedChoiceId: 'c1',
      correctChoiceId: 'c1',
    });
  });
  it('acknowledges an answer without disclosing correctness', async () => {
    const prisma = {
      room: {
        findUnique: jest.fn().mockResolvedValue(room(RoomPhase.ACTIVE)),
      },
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }),
        update: jest.fn(),
      },
      answer: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const result = await new RoomsService(prisma as never).submit(
      '123456',
      'player',
      'token',
      'c1',
    );
    expect(result).toEqual({ accepted: true });
    expect(result).not.toHaveProperty('correct');
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
  it('advances a multi-question poll after reveal', async () => {
    const questions = [
      { id: 'q1', text: 'First', choices: [{ id: 'c1', isCorrect: false }] },
      { id: 'q2', text: 'Second', choices: [{ id: 'c2', isCorrect: false }] },
    ];
    const update = jest.fn().mockResolvedValue({
      status: RoomStatus.ACTIVE,
      phase: RoomPhase.ACTIVE,
      currentQuestionIndex: 1,
    });
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue({
          ...room(RoomPhase.REVEALED, RoomStatus.ACTIVE, ActivityType.POLL),
          quiz: { type: ActivityType.POLL, questions },
        }),
        update,
      },
    } as never);

    await target.next('123456', 'host');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { currentQuestionIndex: 1, phase: RoomPhase.ACTIVE },
    });
  });
  it('reveals poll results without inventing a correct choice', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue({
          ...room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.POLL),
          quiz: {
            type: ActivityType.POLL,
            questions: [
              {
                id: 'q1',
                text: 'Choose',
                choices: [{ id: 'c1', text: 'A', isCorrect: true }],
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({ phase: RoomPhase.REVEALED }),
      },
    } as never);

    await expect(target.reveal('123456', 'host')).resolves.toMatchObject({
      correctChoiceId: null,
    });
  });
  it('exposes poll distribution only after reveal', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest.fn().mockResolvedValue({
          ...room(RoomPhase.REVEALED, RoomStatus.ACTIVE, ActivityType.POLL),
          quiz: {
            type: ActivityType.POLL,
            questions: [
              {
                id: 'q1',
                text: 'Choose',
                choices: [
                  { id: 'c1', text: 'A', isCorrect: false },
                  { id: 'c2', text: 'B', isCorrect: false },
                ],
              },
            ],
          },
        }),
      },
      answer: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ choiceId: 'c1', _count: { _all: 2 } }]),
      },
    } as never);

    await expect(target.result('123456', 'player')).resolves.toMatchObject({
      activityType: ActivityType.POLL,
      poll: {
        responseCount: 2,
        distribution: [
          { id: 'c1', count: 2 },
          { id: 'c2', count: 0 },
        ],
      },
    });
  });
  it('bounds the live leaderboard and appends an exact participant rank', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        participantId: 'leader',
        score: 100,
        participant: { displayName: 'Leader' },
      },
    ]);
    const target = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.COMPLETED, RoomStatus.FINISHED, ActivityType.QUIZ),
          ),
      },
      quizAttempt: {
        findMany,
        findUnique: jest.fn().mockResolvedValue({
          participantId: 'player',
          score: 20,
          participant: { displayName: 'Player' },
        }),
        count: jest.fn().mockResolvedValue(42),
      },
    } as never);

    await expect(target.result('123456', 'player')).resolves.toMatchObject({
      leaderboard: [
        { rank: 1, displayName: 'Leader', score: 100, isYou: false },
        { rank: 43, displayName: 'Player', score: 20, isYou: true },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });
  it('uses attributed word-cloud responders for dashboard completion', async () => {
    const answerFindMany = jest.fn();
    const groupBy = jest
      .fn()
      .mockResolvedValue([
        { participantId: 'player-1' },
        { participantId: null },
      ]);
    const target = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD),
          ),
      },
      participant: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'player-1', displayName: 'Submitted' },
          { id: 'player-2', displayName: 'Waiting' },
        ]),
      },
      answer: { findMany: answerFindMany },
      wordCloudEntry: {
        groupBy,
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'new',
            text: 'New',
            _count: { votes: 0 },
            votes: [],
          },
          {
            id: 'legacy',
            text: 'Legacy',
            _count: { votes: 0 },
            votes: [],
          },
        ]),
      },
      wordCloudVote: { groupBy: jest.fn().mockResolvedValue([]) },
    } as never);

    await expect(target.dashboardState('123456')).resolves.toMatchObject({
      participants: [
        { id: 'player-1', status: 'answered' },
        { id: 'player-2', status: 'waiting' },
      ],
      progress: { submitted: 1, participants: 2 },
    });
    expect(answerFindMany).not.toHaveBeenCalled();
    expect(groupBy).toHaveBeenCalledWith({
      by: ['participantId'],
      where: {
        roomId: 'r1',
        questionId: 'q1',
        participantId: { not: null },
      },
    });
  });
  it('accepts a player word and returns the synchronized aggregation', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'entry' });
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
        create,
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'entry', text: 'CatchUp', _count: { votes: 2 }, votes: [] },
          ]),
      },
      wordCloudVote: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);
    await expect(
      target.submitWord('123456', 'player', 'token', '  CatchUp  '),
    ).resolves.toEqual([
      expect.objectContaining({ text: 'CatchUp', votes: 3, rank: 1 }),
    ]);
    expect(create).toHaveBeenCalledWith({
      data: {
        roomId: 'r1',
        questionId: 'q1',
        participantId: 'player',
        text: 'CatchUp',
        normalizedText: 'catchup',
      },
    });
  });
  it('counts matching submissions as response frequency', async () => {
    const create = jest.fn();
    const target = new RoomsService({
      room: { findUnique: jest.fn().mockResolvedValue(room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD)) },
      quizAttempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }) },
      wordCloudEntry: {
        create,
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'entry' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'entry', text: 'CatchUp', _count: { votes: 1 }, votes: [] }]),
      },
      wordCloudVote: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    } as never);

    await expect(target.submitWord('123456', 'player', 'token', 'CatchUp')).resolves.toEqual([
      expect.objectContaining({ text: 'CatchUp', votes: 2 }),
    ]);
    expect(create).not.toHaveBeenCalled();
  });
  it('moves a word-cloud vote and rejects voting for own entry', async () => {
    const deleteMany = jest.fn();
    const create = jest.fn();
    const target = new RoomsService({
      room: { findUnique: jest.fn().mockResolvedValue(room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD)) },
      quizAttempt: { findFirst: jest.fn().mockResolvedValue({ id: 'attempt' }) },
      wordCloudEntry: {
        findFirst: jest.fn().mockResolvedValue({ id: 'other', participantId: 'other-player' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((action) => action({ wordCloudVote: { deleteMany, create } })),
    } as never);

    await target.voteWord('123456', 'player', 'token', 'other');
    expect(deleteMany).toHaveBeenCalledWith({
      where: { participantId: 'player', entry: { roomId: 'r1', questionId: 'q1' } },
    });
    expect(create).toHaveBeenCalledWith({ data: { entryId: 'other', participantId: 'player' } });

    (target as unknown as { prisma: { wordCloudEntry: { findFirst: jest.Mock } } }).prisma.wordCloudEntry.findFirst.mockResolvedValueOnce({ id: 'own', participantId: 'player' });
    await expect(target.voteWord('123456', 'player', 'token', 'own')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('rejects a second word-cloud response from one participant', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
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
        create: jest.fn().mockRejectedValue(duplicate),
        findFirst: jest.fn().mockResolvedValue({ id: 'existing' }),
      },
      wordCloudVote: { create: jest.fn() },
    } as never);

    await expect(
      target.submitWord('123456', 'player', 'token', 'Another'),
    ).rejects.toMatchObject({ code: 'WORD_ALREADY_SUBMITTED' });
  });
  it('restores whether a participant submitted the word-cloud response', async () => {
    const target = new RoomsService({
      room: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            room(RoomPhase.ACTIVE, RoomStatus.ACTIVE, ActivityType.WORD_CLOUD),
          ),
      },
      participant: { findFirst: jest.fn().mockResolvedValue({ id: 'player' }) },
      wordCloudEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'entry' }),
      },
      wordCloudVote: { findFirst: jest.fn() },
    } as never);

    await expect(
      target.state('123456', 'player', 'token'),
    ).resolves.toMatchObject({ wordSubmitted: true });
  });
});
