import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RoomPhase, RoomStatus } from '@prisma/client';
import type { Server } from 'node:http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RoomEvents } from '../src/modules/rooms/room-events';
import { pointsForAnswer } from '../src/modules/rooms/scoring';
import { PrismaService } from '../src/prisma/prisma.service';

type Envelope<T> = { success: boolean; data: T; error?: { code: string } };
type Participant = { participantId: string; participantToken: string };
type Fixture = {
  code: string;
  hostToken: string;
  roomId: string;
  choices: string[];
};

const body = <T>(response: request.Response) => response.body as Envelope<T>;
const errorCode = (response: request.Response) =>
  body<unknown>(response).error?.code;
const once = <T>(socket: Socket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      5_000,
    );
    socket.once(event, (payload: unknown) => {
      clearTimeout(timeout);
      resolve(payload as T);
    });
  });

jest.setTimeout(60_000);

describe('Production readiness (PostgreSQL + HTTP + Socket.io)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let prisma: PrismaService;
  let baseUrl: string;
  let fixtureSequence = 0;
  const sockets = new Set<Socket>();
  const emailPrefix = 'production-e2e+';

  const cleanup = async () => {
    const owner = { email: { startsWith: emailPrefix } };
    await prisma.room.deleteMany({ where: { quiz: { owner } } });
    await prisma.quiz.deleteMany({ where: { owner } });
    await prisma.user.deleteMany({ where: owner });
  };

  const createFixture = async (): Promise<Fixture> => {
    const suffix = `${Date.now()}-${fixtureSequence++}`;
    const hostToken = body<{ accessToken: string }>(
      await request(httpServer)
        .post('/auth/register')
        .send({
          email: `${emailPrefix}${suffix}@example.test`,
          name: 'Production Host',
          password: 'password123',
        })
        .expect(201),
    ).data.accessToken;
    const quiz = body<{
      id: string;
      questions: { choices: { id: string; isCorrect: boolean }[] }[];
    }>(
      await request(httpServer)
        .post('/quizzes')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: `Production readiness ${suffix}`,
          type: 'QUIZ',
          questions: [
            {
              text: 'First question',
              choices: [
                { text: 'Correct', isCorrect: true },
                { text: 'Incorrect', isCorrect: false },
              ],
            },
            {
              text: 'Second question',
              choices: [
                { text: 'Correct', isCorrect: true },
                { text: 'Incorrect', isCorrect: false },
              ],
            },
          ],
        })
        .expect(201),
    ).data;
    const room = body<{ id: string; code: string }>(
      await request(httpServer)
        .post('/rooms')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ quizId: quiz.id })
        .expect(201),
    ).data;
    return {
      code: room.code,
      hostToken,
      roomId: room.id,
      choices: quiz.questions[0].choices.map((choice) => choice.id),
    };
  };

  const joinParticipant = async (fixture: Fixture, name = 'Participant') =>
    body<Participant>(
      await request(httpServer)
        .post('/rooms/join')
        .send({ code: fixture.code, displayName: name })
        .expect(201),
    ).data;

  const connect = async (token?: string) => {
    const socket = io(`${baseUrl}/rooms`, {
      ...(token ? { auth: { token } } : {}),
      transports: ['websocket'],
    });
    sockets.add(socket);
    await once(socket, 'connect');
    return socket;
  };

  const joinSocket = async (
    socket: Socket,
    code: string,
    participant?: Participant,
  ) => {
    const state = once<{ phase: string }>(socket, RoomEvents.state);
    socket.emit(RoomEvents.join, { code, ...participant });
    return state;
  };

  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      !/test/i.test(new URL(process.env.DATABASE_URL).pathname)
    )
      throw new Error('E2E requires the dedicated test database.');
    process.env.JWT_SECRET = 'e2e-only-secret-at-least-32-characters';
    process.env.TRUST_PROXY_HOPS = '0';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    httpServer = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    baseUrl = await app.getUrl();
    await cleanup();
  });

  afterEach(async () => {
    for (const socket of sockets) socket.disconnect();
    sockets.clear();
    await cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness and PostgreSQL readiness envelopes', async () => {
    expect(
      body<{ status: string }>(
        await request(httpServer).get('/health/live').expect(200),
      ),
    ).toEqual({ success: true, data: { status: 'ok' } });
    expect(
      body<{ status: string }>(
        await request(httpServer).get('/health/ready').expect(200),
      ),
    ).toEqual({ success: true, data: { status: 'ready' } });
  });

  it('advances exactly once for concurrent duplicate HTTP host commands', async () => {
    const fixture = await createFixture();
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(httpServer)
          .post(`/rooms/${fixture.code}/start`)
          .set('Authorization', `Bearer ${fixture.hostToken}`),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(responses.map(errorCode)).toContain('INVALID_ROOM_PHASE');
    expect(
      await prisma.room.findUniqueOrThrow({ where: { id: fixture.roomId } }),
    ).toMatchObject({
      status: RoomStatus.ACTIVE,
      phase: RoomPhase.ACTIVE,
      currentQuestionIndex: 0,
    });
  });

  it('advances one phase for simultaneous duplicate Socket host commands', async () => {
    const fixture = await createFixture();
    await request(httpServer)
      .post(`/rooms/${fixture.code}/start`)
      .set('Authorization', `Bearer ${fixture.hostToken}`)
      .expect(201);
    const host = await connect(fixture.hostToken);
    await joinSocket(host, fixture.code);
    const revealed = once(host, RoomEvents.questionRevealed);
    host.emit(RoomEvents.questionReveal, { code: fixture.code });
    await revealed;

    const started = once<{ question: { position: number } }>(
      host,
      RoomEvents.questionStarted,
    );
    const rejected = once<{ code: string }>(host, RoomEvents.error);
    host.emit(RoomEvents.questionNext, { code: fixture.code });
    host.emit(RoomEvents.questionNext, { code: fixture.code });

    expect((await started).question.position).toBe(2);
    expect((await rejected).code).toBe('INVALID_ROOM_PHASE');
    expect(
      await prisma.room.findUniqueOrThrow({ where: { id: fixture.roomId } }),
    ).toMatchObject({
      phase: RoomPhase.ACTIVE,
      currentQuestionIndex: 1,
    });
  });

  it('restores participant identity without duplicating it on reconnect', async () => {
    const fixture = await createFixture();
    const participant = await joinParticipant(fixture);
    const first = await connect();
    await joinSocket(first, fixture.code, participant);
    const disconnected = once(first, 'disconnect');
    first.disconnect();
    await disconnected;

    const recovered = await connect();
    await joinSocket(recovered, fixture.code, participant);
    const stored = await prisma.participant.findMany({
      where: { roomId: fixture.roomId },
      select: { id: true },
    });

    expect(stored).toEqual([{ id: participant.participantId }]);
  });

  it('throttles normalized HTTP accounts and repeated Socket mutations', async () => {
    const missingEmail = `${emailPrefix}missing-${Date.now()}@example.test`;
    const loginResponses: request.Response[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1)
      loginResponses.push(
        await request(httpServer)
          .post('/auth/login')
          .send({
            email:
              attempt % 2 === 0
                ? missingEmail
                : ` ${missingEmail.toUpperCase()} `,
            password: 'password123',
          }),
      );

    expect(loginResponses.slice(0, 10).map(({ status }) => status)).toEqual(
      Array(10).fill(401),
    );
    expect(loginResponses[10].status).toBe(429);
    expect(errorCode(loginResponses[10])).toBe('RATE_LIMITED');

    const fixture = await createFixture();
    const participant = await joinParticipant(fixture);
    await request(httpServer)
      .post(`/rooms/${fixture.code}/start`)
      .set('Authorization', `Bearer ${fixture.hostToken}`)
      .expect(201);
    const player = await connect();
    await joinSocket(player, fixture.code, participant);
    const acceptedState = once(player, RoomEvents.state);
    const throttled = new Promise<{ code: string }>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for RATE_LIMITED')),
        5_000,
      );
      player.on(RoomEvents.error, (error: { code: string }) => {
        if (error.code === 'RATE_LIMITED') {
          clearTimeout(timeout);
          resolve(error);
        }
      });
    });
    for (let attempt = 0; attempt < 31; attempt += 1)
      player.emit(RoomEvents.answerSubmit, {
        code: fixture.code,
        ...participant,
        choiceId: fixture.choices[0],
      });

    await acceptedState;
    expect((await throttled).code).toBe('RATE_LIMITED');
    const storedRoom = await prisma.room.findUniqueOrThrow({
      where: { id: fixture.roomId },
    });
    const attempts = await prisma.quizAttempt.findMany({
      where: { roomId: fixture.roomId },
      include: { answers: true },
    });
    expect(storedRoom.phase).toBe(RoomPhase.ACTIVE);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].answers).toHaveLength(1);
    expect(attempts[0].score).toBe(pointsForAnswer(true));
  });

  it('keeps answer acceptance consistent when submission races a phase change', async () => {
    const fixture = await createFixture();
    const participant = await joinParticipant(fixture);
    await request(httpServer)
      .post(`/rooms/${fixture.code}/start`)
      .set('Authorization', `Bearer ${fixture.hostToken}`)
      .expect(201);
    const [host, player] = await Promise.all([
      connect(fixture.hostToken),
      connect(),
    ]);
    await Promise.all([
      joinSocket(host, fixture.code),
      joinSocket(player, fixture.code, participant),
    ]);
    const revealed = once(host, RoomEvents.questionRevealed);
    const answerOutcome = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for answer outcome')),
        5_000,
      );
      const finish = (outcome: string) => {
        clearTimeout(timeout);
        player.off(RoomEvents.state, accepted);
        player.off(RoomEvents.error, failed);
        resolve(outcome);
      };
      const accepted = () => finish('accepted');
      const failed = ({ code }: { code: string }) => finish(code);
      player.once(RoomEvents.state, accepted);
      player.once(RoomEvents.error, failed);
    });

    player.emit(RoomEvents.answerSubmit, {
      code: fixture.code,
      ...participant,
      choiceId: fixture.choices[0],
    });
    host.emit(RoomEvents.questionReveal, { code: fixture.code });
    await revealed;
    const outcome = await answerOutcome;
    expect(['accepted', 'INVALID_ROOM_PHASE']).toContain(outcome);

    const storedRoom = await prisma.room.findUniqueOrThrow({
      where: { id: fixture.roomId },
    });
    const storedAnswers = await prisma.answer.count({
      where: { attempt: { roomId: fixture.roomId } },
    });
    expect(storedRoom.phase).toBe(RoomPhase.REVEALED);
    expect(storedAnswers).toBe(outcome === 'accepted' ? 1 : 0);

    const rejected = once<{ code: string }>(player, RoomEvents.error);
    player.emit(RoomEvents.answerSubmit, {
      code: fixture.code,
      ...participant,
      choiceId: fixture.choices[1],
    });
    expect((await rejected).code).toBe('INVALID_ROOM_PHASE');
  });
});
