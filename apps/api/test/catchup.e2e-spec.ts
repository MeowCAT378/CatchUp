import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ActivityType, Role, RoomPhase, RoomStatus } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import * as ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Envelope<T> = { success: boolean; data: T; error?: { code: string } };
const body = <T>(response: request.Response) => response.body as Envelope<T>;
const errorCode = (response: request.Response) =>
  body<unknown>(response).error?.code;
const once = <T>(socket: Socket, event: string) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      5_000,
    );
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

describe('CatchUp critical flow (PostgreSQL + REST + Socket.io)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let hostToken: string;
  let otherHostToken: string;
  let playerToken: string;
  let code: string;
  let participant: { participantId: string; participantToken: string };
  let hostSocket: Socket;
  let playerSocket: Socket;
  let recoveredSocket: Socket;
  const cleanup = async () => {
    const where = { quiz: { owner: { email: { startsWith: 'e2e+' } } } };
    await prisma.room.deleteMany({ where });
    await prisma.quiz.deleteMany({
      where: { owner: { email: { startsWith: 'e2e+' } } },
    });
    await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [
          { admin: { email: { startsWith: 'e2e+' } } },
          { targetUser: { email: { startsWith: 'e2e+' } } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e+' } } });
  };

  beforeAll(async () => {
    if (
      !process.env.DATABASE_URL ||
      !/test/i.test(new URL(process.env.DATABASE_URL).pathname)
    )
      throw new Error('E2E requires the dedicated test database.');
    process.env.JWT_SECRET = 'e2e-only-secret-at-least-32-characters';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    prisma = app.get(PrismaService);
    await cleanup();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    hostSocket?.disconnect();
    playerSocket?.disconnect();
    recoveredSocket?.disconnect();
    await cleanup();
    await app.close();
  });

  it('runs the persisted, authorized quiz lifecycle and exports results', async () => {
    const register = async (email: string, name: string) =>
      body<{ accessToken: string }>(
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email, name, password: 'password123' })
          .expect(201),
      ).data.accessToken;
    hostToken = await register('e2e+host@example.test', 'Host');
    otherHostToken = await register('e2e+other@example.test', 'Other host');
    await prisma.user.update({
      where: { email: 'e2e+other@example.test' },
      data: { role: Role.PLAYER },
    });
    playerToken = body<{ accessToken: string }>(
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e+other@example.test', password: 'password123' }),
    ).data.accessToken;

    await request(app.getHttpServer()).get('/quizzes').expect(401);
    const quiz = body<{
      id: string;
      type: 'QUIZ';
      questions: {
        id: string;
        choices: { id: string; isCorrect: boolean }[];
      }[];
    }>(
      await request(app.getHttpServer())
        .post('/quizzes')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'แบบทดสอบ =Thai',
          type: 'QUIZ',
          questions: [
            {
              text: 'คำถามหนึ่ง',
              choices: [
                { text: '=สูตร', isCorrect: true },
                { text: 'ผิด', isCorrect: false },
              ],
            },
            {
              text: 'คำถามสอง',
              choices: [
                { text: 'ถูก', isCorrect: true },
                { text: 'ผิด', isCorrect: false },
              ],
            },
          ],
        }),
    ).data;
    expect(quiz.type).toBe('QUIZ');
    const activities = await Promise.all(
      ['POLL', 'WORD_CLOUD'].map((type) =>
        request(app.getHttpServer())
          .post('/quizzes')
          .set('Authorization', `Bearer ${hostToken}`)
          .send({ title: `Test ${type}`, type })
          .expect(201),
      ),
    );
    expect(
      activities.map((response) => body<{ type: string }>(response).data.type),
    ).toEqual(['POLL', 'WORD_CLOUD']);
    const listedActivities = body<{ id: string; type: string }[]>(
      await request(app.getHttpServer())
        .get('/quizzes')
        .set('Authorization', `Bearer ${hostToken}`),
    ).data;
    expect(listedActivities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: quiz.id, type: 'QUIZ' }),
        expect.objectContaining({ type: 'POLL' }),
        expect.objectContaining({ type: 'WORD_CLOUD' }),
      ]),
    );
    await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Missing type' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/quizzes')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Unknown type', type: 'UNKNOWN' })
      .expect(400);
    expect(
      body<{ questions: unknown[] }>(
        await request(app.getHttpServer())
          .get(`/quizzes/${quiz.id}`)
          .set('Authorization', `Bearer ${hostToken}`),
      ).data.questions,
    ).toHaveLength(2);
    const room = body<{ code: string }>(
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ quizId: quiz.id }),
    ).data;
    code = room.code;
    expect(code).toMatch(/^\d{6}$/);
    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({ code: 'ABC123', displayName: 'Invalid' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/rooms/join')
      .send({ code: '12345', displayName: 'Invalid' })
      .expect(400);
    expect(
      body<{ phase: string }>(
        await request(app.getHttpServer()).get(`/rooms/${code}`),
      ).data.phase,
    ).toBe('WAITING');
    expect(
      errorCode(
        await request(app.getHttpServer())
          .post(`/rooms/${code}/start`)
          .set('Authorization', `Bearer ${otherHostToken}`),
      ),
    ).toBe('FORBIDDEN');

    participant = body<typeof participant>(
      await request(app.getHttpServer())
        .post('/rooms/join')
        .send({ code, displayName: '=นักเรียนไทย' }),
    ).data;
    const otherParticipant = body<typeof participant>(
      await request(app.getHttpServer())
        .post('/rooms/join')
        .send({ code, displayName: 'Second' }),
    ).data;
    expect(
      errorCode(
        await request(app.getHttpServer())
          .get(`/rooms/${code}`)
          .set('X-Participant-Id', participant.participantId),
      ),
    ).toBe('PARTICIPANT_NOT_FOUND');
    expect(
      errorCode(
        await request(app.getHttpServer())
          .get(`/rooms/${code}`)
          .set('X-Participant-Id', participant.participantId)
          .set('X-Participant-Token', otherParticipant.participantToken),
      ),
    ).toBe('PARTICIPANT_NOT_FOUND');

    hostSocket = io(`${baseUrl}/rooms`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    playerSocket = io(`${baseUrl}/rooms`, { transports: ['websocket'] });
    await Promise.all([
      once(hostSocket, 'connect'),
      once(playerSocket, 'connect'),
    ]);
    const hostReady = once(hostSocket, 'room:state');
    hostSocket.emit('room:join', { code });
    await hostReady;
    const joined = once<{ participantId: string }>(
      hostSocket,
      'participant:joined',
    );
    const playerWaiting = once<{ question: null }>(playerSocket, 'room:state');
    playerSocket.emit('room:join', { code, ...participant });
    expect((await joined).participantId).toBe(participant.participantId);
    expect((await playerWaiting).question).toBeNull();

    const started = once<{
      question: {
        choices: Record<string, unknown>[];
        correctChoiceId?: string;
      };
    }>(playerSocket, 'question:started');
    hostSocket.emit('quiz:start', { code });
    const active = await started;
    expect(active.question.correctChoiceId).toBeUndefined();
    expect(
      active.question.choices.every((choice) => !('isCorrect' in choice)),
    ).toBe(true);
    recoveredSocket = io(`${baseUrl}/rooms`, { transports: ['websocket'] });
    await once(recoveredSocket, 'connect');
    const recovered = once<{ phase: string; question: { position: number } }>(
      recoveredSocket,
      'room:state',
    );
    recoveredSocket.emit('room:join', { code, ...participant });
    expect((await recovered).question.position).toBe(1);
    expect(
      body<{ participants: unknown[] }>(
        await request(app.getHttpServer())
          .get(`/rooms/${code}/dashboard`)
          .set('Authorization', `Bearer ${hostToken}`),
      ).data.participants,
    ).toHaveLength(2);
    const firstQuestion = quiz.questions[0];
    const progress = once<{
      progress: { submitted: number; participants: number };
    }>(hostSocket, 'dashboard:updated');
    playerSocket.emit('answer:submit', {
      code,
      ...participant,
      choiceId: firstQuestion.choices.find((choice) => choice.isCorrect)!.id,
    });
    expect((await progress).progress).toEqual({
      submitted: 1,
      participants: 2,
    });
    const duplicate = once<{ code: string }>(playerSocket, 'room:error');
    playerSocket.emit('answer:submit', {
      code,
      ...participant,
      choiceId: firstQuestion.choices[1].id,
    });
    expect((await duplicate).code).toBe('ALREADY_ANSWERED');
    const selected = body<{
      selectedChoiceId: string | null;
      correctChoiceId?: string | null;
    }>(
      await request(app.getHttpServer())
        .get(`/rooms/${code}`)
        .set('X-Participant-Id', participant.participantId)
        .set('X-Participant-Token', participant.participantToken),
    ).data;
    expect(selected.selectedChoiceId).toBe(firstQuestion.choices[0].id);
    expect(selected).not.toHaveProperty('correctChoiceId');
    const accepted = await request(app.getHttpServer())
      .post(`/rooms/${code}/answers`)
      .send({
        code,
        participantId: otherParticipant.participantId,
        participantToken: otherParticipant.participantToken,
        choiceId: firstQuestion.choices[1].id,
      })
      .expect(201);
    expect(body<{ accepted: boolean }>(accepted).data).toEqual({
      accepted: true,
    });
    expect(body<Record<string, unknown>>(accepted).data).not.toHaveProperty(
      'correct',
    );
    expect(
      errorCode(
        await request(app.getHttpServer())
          .get(`/rooms/${code}/result`)
          .set('X-Participant-Id', participant.participantId)
          .set('X-Participant-Token', participant.participantToken),
      ),
    ).toBe('INVALID_ROOM_PHASE');

    const revealed = once<{ correctChoiceId: string }>(
      playerSocket,
      'question:revealed',
    );
    hostSocket.emit('question:reveal', { code });
    expect((await revealed).correctChoiceId).toBe(firstQuestion.choices[0].id);
    expect(
      body<{ correctChoiceId: string }>(
        await request(app.getHttpServer())
          .get(`/rooms/${code}`)
          .set('X-Participant-Id', participant.participantId)
          .set('X-Participant-Token', participant.participantToken),
      ).data.correctChoiceId,
    ).toBe(firstQuestion.choices[0].id);
    await request(app.getHttpServer())
      .get(`/rooms/${code}/result`)
      .set('X-Participant-Id', participant.participantId)
      .set('X-Participant-Token', participant.participantToken)
      .expect(200);
    expect(
      errorCode(
        await request(app.getHttpServer()).post(`/rooms/${code}/answers`).send({
          participantId: participant.participantId,
          participantToken: participant.participantToken,
          choiceId: firstQuestion.choices[0].id,
        }),
      ),
    ).toBe('INVALID_ROOM_PHASE');
    const next = once<{ question: { position: number } }>(
      playerSocket,
      'question:started',
    );
    hostSocket.emit('question:next', { code });
    expect((await next).question.position).toBe(2);
    expect(
      body<{ question: { position: number }; answerSubmitted: boolean }>(
        await request(app.getHttpServer())
          .get(`/rooms/${code}`)
          .set('X-Participant-Id', participant.participantId)
          .set('X-Participant-Token', participant.participantToken),
      ).data,
    ).toMatchObject({ question: { position: 2 }, answerSubmitted: false });
    recoveredSocket.disconnect();
    recoveredSocket = io(`${baseUrl}/rooms`, { transports: ['websocket'] });
    await once(recoveredSocket, 'connect');
    const recoveredCurrent = once<{ question: { position: number } }>(
      recoveredSocket,
      'room:state',
    );
    recoveredSocket.emit('room:join', { code, ...participant });
    expect((await recoveredCurrent).question.position).toBe(2);
    const completed = once<{ phase: string }>(playerSocket, 'quiz:completed');
    hostSocket.emit('quiz:complete', { code });
    await completed;

    await request(app.getHttpServer())
      .get(
        `/rooms/${code}/result?participantId=${participant.participantId}&participantToken=${participant.participantToken}`,
      )
      .expect(403);
    expect(
      body<{ leaderboard: { isYou: boolean }[] }>(
        await request(app.getHttpServer())
          .get(`/rooms/${code}/result`)
          .set('X-Participant-Id', participant.participantId)
          .set('X-Participant-Token', participant.participantToken)
          .expect(200),
      ).data.leaderboard.some((entry) => entry.isYou),
    ).toBe(true);

    expect(
      errorCode(
        await request(app.getHttpServer())
          .get(`/rooms/${code}/results`)
          .set('Authorization', `Bearer ${playerToken}`),
      ),
    ).toBe('FORBIDDEN');
    expect(
      errorCode(
        await request(app.getHttpServer())
          .post(`/rooms/${code}/start`)
          .set('Authorization', `Bearer ${hostToken}`),
      ),
    ).toBe('INVALID_ROOM_PHASE');
    const results = body<{
      summary: {
        totalParticipants: number;
        totalSubmittedAnswers: number;
        completionRate: number;
      };
      participants: { rank: number; score: number }[];
      questions: { correctChoiceId: string | null }[];
    }>(
      await request(app.getHttpServer())
        .get(`/rooms/${code}/results`)
        .set('Authorization', `Bearer ${hostToken}`),
    ).data;
    expect(results.summary).toMatchObject({
      totalParticipants: 2,
      totalSubmittedAnswers: 2,
      completionRate: 50,
    });
    expect(results.participants.map((item) => item.rank)).toEqual([1, 2]);
    expect(results.questions[0].correctChoiceId).toBe(
      firstQuestion.choices[0].id,
    );
    const csv = await request(app.getHttpServer())
      .get(`/rooms/${code}/results/export.csv`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect('Content-Type', /text\/csv/)
      .expect(200);
    expect(csv.text).toContain('นักเรียนไทย');
    expect(csv.text).toContain("'=นักเรียนไทย");
    const xlsx = await request(app.getHttpServer())
      .get(`/rooms/${code}/results/export.xlsx`)
      .set('Authorization', `Bearer ${hostToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect('Content-Type', /spreadsheetml/)
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body);
    expect(workbook.getWorksheet('Leaderboard')?.getColumn(2).values).toContain(
      "'=นักเรียนไทย",
    );
  }, 30_000);

  it('creates users and revokes REST and host Socket.io tokens on reset or disable', async () => {
    const register = async (email: string, name: string) =>
      body<{ accessToken: string }>(
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email, name, password: 'password123' })
          .expect(201),
      ).data.accessToken;
    const login = async (email: string, password: string) =>
      body<{ accessToken: string }>(
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password })
          .expect(201),
      ).data.accessToken;
    const adminEmail = 'e2e+admin-users@example.test';
    const hostEmail = 'e2e+managed-host@example.test';
    await register(adminEmail, 'Admin');
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });
    const adminToken = await login(adminEmail, 'password123');
    const ordinaryHostToken = await register(
      'e2e+ordinary-host@example.test',
      'Ordinary Host',
    );

    await request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${ordinaryHostToken}`)
      .send({
        name: 'Blocked',
        email: 'e2e+blocked@example.test',
        password: 'password123',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/admin/users/missing/password')
      .set('Authorization', `Bearer ${ordinaryHostToken}`)
      .send({ password: 'new-password123' })
      .expect(403);

    const created = body<{ id: string; role: Role; isDisabled: boolean }>(
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Managed Host',
          email: hostEmail,
          password: 'password123',
        })
        .expect(201),
    ).data;
    expect(created).toMatchObject({ role: Role.HOST, isDisabled: false });
    expect(created).not.toHaveProperty('passwordHash');
    expect(created).not.toHaveProperty('tokenVersion');
    await expect(
      prisma.adminAuditLog.findFirst({
        where: {
          admin: { email: adminEmail },
          targetUserId: created.id,
          action: 'TEACHER_CREATED',
        },
      }),
    ).resolves.toBeTruthy();
    await request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', email: hostEmail, password: 'password123' })
      .expect(409)
      .expect((response) => expect(errorCode(response)).toBe('EMAIL_IN_USE'));

    const oldToken = await login(hostEmail, 'password123');
    const quiz = body<{ id: string }>(
      await request(app.getHttpServer())
        .post('/quizzes')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          title: 'Revocation quiz',
          type: 'QUIZ',
          questions: [
            {
              text: 'Question',
              choices: [
                { text: 'Correct', isCorrect: true },
                { text: 'Wrong', isCorrect: false },
              ],
            },
          ],
        })
        .expect(201),
    ).data;
    const managedRoom = body<{ code: string }>(
      await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ quizId: quiz.id })
        .expect(201),
    ).data;
    const managedSocket = io(`${baseUrl}/rooms`, {
      auth: { token: oldToken },
      transports: ['websocket'],
    });
    await once(managedSocket, 'connect');
    const ready = once(managedSocket, 'room:state');
    managedSocket.emit('room:join', { code: managedRoom.code });
    await ready;
    const disconnected = once(managedSocket, 'disconnect');

    await request(app.getHttpServer())
      .patch(`/admin/users/${created.id}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'new-password123' })
      .expect(200)
      .expect((response) =>
        expect(
          body<{ id: string; currentSessionInvalidated: boolean }>(response)
            .data,
        ).toEqual({
          id: created.id,
          currentSessionInvalidated: false,
        }),
      );
    await disconnected;
    await expect(
      prisma.adminAuditLog.findFirst({
        where: {
          admin: { email: adminEmail },
          targetUserId: created.id,
          action: 'USER_PASSWORD_RESET',
        },
      }),
    ).resolves.toBeTruthy();
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: hostEmail, password: 'password123' })
      .expect(401);
    const resetToken = await login(hostEmail, 'new-password123');

    const staleSocket = io(`${baseUrl}/rooms`, {
      auth: { token: oldToken },
      transports: ['websocket'],
    });
    await once(staleSocket, 'connect');
    const staleError = once<{ code: string }>(staleSocket, 'room:error');
    staleSocket.emit('room:join', { code: managedRoom.code });
    expect((await staleError).code).toBe('FORBIDDEN');
    staleSocket.disconnect();

    await request(app.getHttpServer())
      .patch(`/admin/teachers/${created.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isDisabled: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/admin/teachers/${created.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isDisabled: false })
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${resetToken}`)
      .expect(401);
    await expect(login(hostEmail, 'new-password123')).resolves.toEqual(
      expect.any(String),
    );
  });

  it('deletes unused questions but preserves questions used by rooms', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'e2e+host@example.test' },
    });
    const createActivity = async (
      type: 'QUIZ' | 'POLL' | 'WORD_CLOUD',
      suffix: string,
    ) =>
      prisma.quiz.create({
        data: {
          title: `Delete ${suffix}`,
          type,
          ownerId: owner.id,
          questions: {
            create: [
              {
                text: `Used ${suffix}`,
                position: 0,
                choices:
                  type === 'WORD_CLOUD'
                    ? undefined
                    : {
                        create: [
                          { text: 'Yes', isCorrect: type === 'QUIZ' },
                          { text: 'No', isCorrect: false },
                        ],
                      },
              },
              ...(type === 'WORD_CLOUD'
                ? []
                : [
                    {
                      text: `Unused ${suffix}`,
                      position: 1,
                      choices: {
                        create: [{ text: 'Only', isCorrect: type === 'QUIZ' }],
                      },
                    },
                  ]),
            ],
          },
        },
        include: {
          questions: {
            include: { choices: true },
            orderBy: { position: 'asc' },
          },
        },
      });
    const createResponse = async (
      quizId: string,
      questionId: string,
      choiceId: string,
      code: string,
      activityTitle: string,
      activityType: ActivityType,
    ) => {
      const room = await prisma.room.create({
        data: {
          quizId,
          hostId: owner.id,
          code,
          activityTitle,
          activityType,
          status: 'ACTIVE',
        },
      });
      const participant = await prisma.participant.create({
        data: { roomId: room.id, displayName: `Player ${code}` },
      });
      const attempt = await prisma.quizAttempt.create({
        data: { roomId: room.id, participantId: participant.id },
      });
      await prisma.answer.create({
        data: { attemptId: attempt.id, questionId, choiceId, isCorrect: false },
      });
    };

    const quiz = await createActivity('QUIZ', 'quiz');
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${quiz.questions[1].id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200);
    expect(
      await prisma.question.findMany({
        where: { quizId: quiz.id },
        orderBy: { position: 'asc' },
      }),
    ).toMatchObject([{ id: quiz.questions[0].id, position: 0 }]);

    await createResponse(
      quiz.id,
      quiz.questions[0].id,
      quiz.questions[0].choices[0].id,
      '900001',
      quiz.title,
      quiz.type,
    );
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${quiz.questions[0].id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(409);
    expect(
      await prisma.answer.count({
        where: { questionId: quiz.questions[0].id },
      }),
    ).toBe(1);
    expect(
      await prisma.choice.count({
        where: { questionId: quiz.questions[0].id },
      }),
    ).toBe(2);

    const poll = await createActivity('POLL', 'poll');
    await createResponse(
      poll.id,
      poll.questions[0].id,
      poll.questions[0].choices[0].id,
      '900002',
      poll.title,
      poll.type,
    );
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${poll.questions[0].id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${poll.questions[1].id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(409);
    expect(
      await prisma.answer.count({
        where: { questionId: poll.questions[0].id },
      }),
    ).toBe(1);
    expect(await prisma.question.count({ where: { quizId: poll.id } })).toBe(2);

    const wordCloud = await createActivity('WORD_CLOUD', 'word cloud');
    const wordRoom = await prisma.room.create({
      data: {
        quizId: wordCloud.id,
        hostId: owner.id,
        code: '900003',
        activityTitle: wordCloud.title,
        activityType: wordCloud.type,
      },
    });
    const wordParticipant = await prisma.participant.create({
      data: { roomId: wordRoom.id, displayName: 'Word player' },
    });
    const entry = await prisma.wordCloudEntry.create({
      data: {
        roomId: wordRoom.id,
        questionId: wordCloud.questions[0].id,
        participantId: wordParticipant.id,
        text: 'Cloud',
        normalizedText: 'cloud',
      },
    });
    await prisma.wordCloudVote.create({
      data: { entryId: entry.id, participantId: wordParticipant.id },
    });
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${wordCloud.questions[0].id}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(409);
    expect(
      await prisma.wordCloudEntry.count({
        where: { questionId: wordCloud.questions[0].id },
      }),
    ).toBe(1);
    expect(
      await prisma.wordCloudVote.count({ where: { entryId: entry.id } }),
    ).toBe(1);

    const otherTeacherToken = body<{ accessToken: string }>(
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'e2e+teacher@example.test',
        name: 'Teacher',
        password: 'password123',
      }),
    ).data.accessToken;
    const protectedQuiz = await createActivity('QUIZ', 'protected');
    await request(app.getHttpServer())
      .delete(`/quizzes/questions/${protectedQuiz.questions[0].id}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete('/quizzes/questions/missing-question')
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(404);
  });

  it('soft-deletes owned activities and preserves persisted room data', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: 'e2e+host@example.test' },
    });
    let roomSequence = 0;
    const createActivity = async (type: 'QUIZ' | 'POLL' | 'WORD_CLOUD') => {
      const activity = await prisma.quiz.create({
        data: {
          title: `Delete activity ${type}`,
          type,
          ownerId: owner.id,
          questions: {
            create: {
              text: 'Question',
              position: 0,
              choices:
                type === 'WORD_CLOUD'
                  ? undefined
                  : {
                      create: [
                        { text: 'Yes', isCorrect: type === 'QUIZ' },
                        { text: 'No', isCorrect: false },
                      ],
                    },
            },
          },
        },
        include: { questions: { include: { choices: true } } },
      });
      const room = await prisma.room.create({
        data: {
          quizId: activity.id,
          hostId: owner.id,
          code: `8${String(++roomSequence).padStart(5, '0')}`,
          activityTitle: activity.title,
          activityType: type,
          ...(type === 'WORD_CLOUD'
            ? { status: RoomStatus.FINISHED, phase: RoomPhase.COMPLETED }
            : {}),
        },
      });
      const participant = await prisma.participant.create({
        data: { roomId: room.id, displayName: `Player ${type}` },
      });
      const attempt = await prisma.quizAttempt.create({
        data: { roomId: room.id, participantId: participant.id },
      });
      if (type === 'WORD_CLOUD') {
        const entry = await prisma.wordCloudEntry.create({
          data: {
            roomId: room.id,
            questionId: activity.questions[0].id,
            participantId: participant.id,
            text: 'Cloud',
            normalizedText: 'cloud',
          },
        });
        await prisma.wordCloudVote.create({
          data: { entryId: entry.id, participantId: participant.id },
        });
      } else {
        await prisma.answer.create({
          data: {
            attemptId: attempt.id,
            questionId: activity.questions[0].id,
            choiceId: activity.questions[0].choices[0].id,
            isCorrect: false,
          },
        });
      }
      return { activity, room, participant, attempt };
    };
    for (const type of ['QUIZ', 'POLL', 'WORD_CLOUD'] as const) {
      const created = await createActivity(type);
      await request(app.getHttpServer())
        .delete(`/quizzes/${created.activity.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);
      const deletedActivity = await prisma.quiz.findUnique({
        where: { id: created.activity.id },
      });
      expect(deletedActivity?.deletedAt).toBeInstanceOf(Date);
      await expect(
        prisma.room.findUnique({ where: { id: created.room.id } }),
      ).resolves.toMatchObject({ id: created.room.id });
      await expect(
        prisma.participant.findUnique({
          where: { id: created.participant.id },
        }),
      ).resolves.toMatchObject({ id: created.participant.id });
      await expect(
        prisma.quizAttempt.findUnique({ where: { id: created.attempt.id } }),
      ).resolves.toMatchObject({ id: created.attempt.id });
      expect(
        await prisma.question.count({ where: { quizId: created.activity.id } }),
      ).toBe(1);
      expect(
        await prisma.choice.count({
          where: { questionId: created.activity.questions[0].id },
        }),
      ).toBe(type === 'WORD_CLOUD' ? 0 : 2);
      expect(
        await prisma.answer.count({ where: { attemptId: created.attempt.id } }),
      ).toBe(type === 'WORD_CLOUD' ? 0 : 1);
      expect(
        await prisma.wordCloudEntry.count({
          where: { roomId: created.room.id },
        }),
      ).toBe(type === 'WORD_CLOUD' ? 1 : 0);
      expect(
        await prisma.wordCloudVote.count({
          where: { participantId: created.participant.id },
        }),
      ).toBe(type === 'WORD_CLOUD' ? 1 : 0);
    }
    const otherToken = body<{ accessToken: string }>(
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'e2e+delete-other@example.test',
        name: 'Other',
        password: 'password123',
      }),
    ).data.accessToken;
    const protectedActivity = await createActivity('QUIZ');
    await request(app.getHttpServer())
      .delete(`/quizzes/${protectedActivity.activity.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete('/quizzes/missing-activity')
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(404)
      .expect((response) => expect(errorCode(response)).toBe('QUIZ_NOT_FOUND'));
  });
});
