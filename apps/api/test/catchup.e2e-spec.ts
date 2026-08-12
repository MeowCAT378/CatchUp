import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import * as ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Envelope<T> = { success: boolean; data: T; error?: { code: string } };
const body = <T>(response: request.Response) => response.body as Envelope<T>;
const once = <T>(socket: Socket, event: string) => new Promise<T>((resolve, reject) => { const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 5_000); socket.once(event, (payload) => { clearTimeout(timeout); resolve(payload); }); });

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
  const cleanup = async () => { const where = { quiz: { owner: { email: { startsWith: 'e2e+' } } } }; await prisma.room.deleteMany({ where }); await prisma.quiz.deleteMany({ where: { owner: { email: { startsWith: 'e2e+' } } } }); await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e+' } } }); };

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !/test/i.test(new URL(process.env.DATABASE_URL).pathname)) throw new Error('E2E requires the dedicated test database.');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    prisma = app.get(PrismaService);
    await cleanup();
    baseUrl = await app.getUrl();
  });

  afterAll(async () => { hostSocket?.disconnect(); playerSocket?.disconnect(); recoveredSocket?.disconnect(); await cleanup(); await app.close(); });

  it('runs the persisted, authorized quiz lifecycle and exports results', async () => {
    const register = async (email: string, name: string) => body<{ accessToken: string }>(await request(app.getHttpServer()).post('/auth/register').send({ email, name, password: 'password123' }).expect(201)).data.accessToken;
    hostToken = await register('e2e+host@example.test', 'Host');
    otherHostToken = await register('e2e+other@example.test', 'Other host');
    await prisma.user.update({ where: { email: 'e2e+other@example.test' }, data: { role: Role.PLAYER } });
    playerToken = body<{ accessToken: string }>(await request(app.getHttpServer()).post('/auth/login').send({ email: 'e2e+other@example.test', password: 'password123' })).data.accessToken;

    await request(app.getHttpServer()).get('/quizzes').expect(401);
    const quiz = body<{ id: string; questions: { id: string; choices: { id: string; isCorrect: boolean }[] }[] }>(await request(app.getHttpServer()).post('/quizzes').set('Authorization', `Bearer ${hostToken}`).send({ title: 'แบบทดสอบ =Thai', questions: [{ text: 'คำถามหนึ่ง', choices: [{ text: '=สูตร', isCorrect: true }, { text: 'ผิด', isCorrect: false }] }, { text: 'คำถามสอง', choices: [{ text: 'ถูก', isCorrect: true }, { text: 'ผิด', isCorrect: false }] }] })).data;
    expect((await request(app.getHttpServer()).get(`/quizzes/${quiz.id}`).set('Authorization', `Bearer ${hostToken}`)).body.data.questions).toHaveLength(2);
    const room = body<{ code: string }>(await request(app.getHttpServer()).post('/rooms').set('Authorization', `Bearer ${hostToken}`).send({ quizId: quiz.id })).data;
    code = room.code;
    expect(body<{ phase: string }>(await request(app.getHttpServer()).get(`/rooms/${code}`)).data.phase).toBe('WAITING');
    expect((await request(app.getHttpServer()).post(`/rooms/${code}/start`).set('Authorization', `Bearer ${otherHostToken}`)).body.error.code).toBe('FORBIDDEN');

    participant = body<typeof participant>(await request(app.getHttpServer()).post('/rooms/join').send({ code, displayName: '=นักเรียนไทย' })).data;
    const otherParticipant = body<typeof participant>(await request(app.getHttpServer()).post('/rooms/join').send({ code, displayName: 'Second' })).data;
    expect((await request(app.getHttpServer()).get(`/rooms/${code}?participantId=${participant.participantId}`)).body.error.code).toBe('PARTICIPANT_NOT_FOUND');
    expect((await request(app.getHttpServer()).get(`/rooms/${code}?participantId=${participant.participantId}&participantToken=${otherParticipant.participantToken}`)).body.error.code).toBe('PARTICIPANT_NOT_FOUND');

    hostSocket = io(`${baseUrl}/rooms`, { auth: { token: hostToken }, transports: ['websocket'] });
    playerSocket = io(`${baseUrl}/rooms`, { transports: ['websocket'] });
    await Promise.all([once(hostSocket, 'connect'), once(playerSocket, 'connect')]);
    const hostReady = once(hostSocket, 'room:state');
    hostSocket.emit('room:join', { code });
    await hostReady;
    const joined = once<{ participantId: string }>(hostSocket, 'participant:joined');
    const playerWaiting = once<{ question: null }>(playerSocket, 'room:state');
    playerSocket.emit('room:join', { code, ...participant });
    expect((await joined).participantId).toBe(participant.participantId);
    expect((await playerWaiting).question).toBeNull();

    const started = once<{ question: { choices: Record<string, unknown>[]; correctChoiceId?: string } }>(playerSocket, 'question:started');
    hostSocket.emit('quiz:start', { code });
    const active = await started;
    expect(active.question.correctChoiceId).toBeUndefined();
    expect(active.question.choices.every((choice) => !('isCorrect' in choice))).toBe(true);
    recoveredSocket = io(`${baseUrl}/rooms`, { transports: ['websocket'] });
    await once(recoveredSocket, 'connect');
    const recovered = once<{ phase: string; question: { position: number } }>(recoveredSocket, 'room:state');
    recoveredSocket.emit('room:join', { code, ...participant });
    expect((await recovered).question.position).toBe(1);
    expect(body<{ participants: unknown[] }>(await request(app.getHttpServer()).get(`/rooms/${code}/dashboard`).set('Authorization', `Bearer ${hostToken}`)).data.participants).toHaveLength(2);
    const firstQuestion = quiz.questions[0];
    const progress = once<{ submitted: number; participants: number }>(hostSocket, 'answer:progress');
    playerSocket.emit('answer:submit', { code, ...participant, choiceId: firstQuestion.choices.find((choice) => choice.isCorrect)!.id });
    expect(await progress).toEqual({ submitted: 1, participants: 2 });
    const duplicate = once<{ code: string }>(playerSocket, 'room:error');
    playerSocket.emit('answer:submit', { code, ...participant, choiceId: firstQuestion.choices[1].id });
    expect((await duplicate).code).toBe('ALREADY_ANSWERED');
    await request(app.getHttpServer()).post(`/rooms/${code}/answers`).send({ code, participantId: otherParticipant.participantId, participantToken: otherParticipant.participantToken, choiceId: firstQuestion.choices[1].id }).expect(201);

    const revealed = once<{ correctChoiceId: string }>(playerSocket, 'question:revealed');
    hostSocket.emit('question:reveal', { code });
    expect((await revealed).correctChoiceId).toBe(firstQuestion.choices[0].id);
    expect((await request(app.getHttpServer()).post(`/rooms/${code}/answers`).send({ participantId: participant.participantId, participantToken: participant.participantToken, choiceId: firstQuestion.choices[0].id })).body.error.code).toBe('INVALID_ROOM_PHASE');
    const next = once<{ question: { position: number } }>(playerSocket, 'question:started');
    hostSocket.emit('question:next', { code });
    expect((await next).question.position).toBe(2);
    const completed = once<{ phase: string }>(playerSocket, 'quiz:completed');
    hostSocket.emit('quiz:complete', { code });
    await completed;

    expect((await request(app.getHttpServer()).get(`/rooms/${code}/results`).set('Authorization', `Bearer ${playerToken}`)).body.error.code).toBe('FORBIDDEN');
    expect((await request(app.getHttpServer()).post(`/rooms/${code}/start`).set('Authorization', `Bearer ${hostToken}`)).body.error.code).toBe('INVALID_ROOM_PHASE');
    const results = body<{ summary: { totalParticipants: number; totalSubmittedAnswers: number; completionRate: number }; participants: { rank: number; score: number }[]; questions: { correctChoiceId: string | null }[] }>(await request(app.getHttpServer()).get(`/rooms/${code}/results`).set('Authorization', `Bearer ${hostToken}`)).data;
    expect(results.summary).toMatchObject({ totalParticipants: 2, totalSubmittedAnswers: 2, completionRate: 50 });
    expect(results.participants.map((item) => item.rank)).toEqual([1, 2]);
    expect(results.questions[0].correctChoiceId).toBe(firstQuestion.choices[0].id);
    const csv = await request(app.getHttpServer()).get(`/rooms/${code}/results/export.csv`).set('Authorization', `Bearer ${hostToken}`).expect('Content-Type', /text\/csv/).expect(200);
    expect(csv.text).toContain('นักเรียนไทย'); expect(csv.text).toContain("'=นักเรียนไทย");
    const xlsx = await request(app.getHttpServer()).get(`/rooms/${code}/results/export.xlsx`).set('Authorization', `Bearer ${hostToken}`).buffer(true).parse((response, callback) => { const chunks: Buffer[] = []; response.on('data', (chunk) => chunks.push(chunk)); response.on('end', () => callback(null, Buffer.concat(chunks))); }).expect('Content-Type', /spreadsheetml/).expect(200);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(xlsx.body); expect(workbook.getWorksheet('Participants')?.getColumn(2).values).toContain("'=นักเรียนไทย");
  }, 30_000);
});
