const { PrismaClient, RoomPhase, RoomStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();
const ALLOWED_SEED_ENVIRONMENTS = new Set(['development', 'test']);

function assertSeedEnvironment(value) {
  const environment = value?.trim().toLowerCase();
  if (!environment || !ALLOWED_SEED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      'Database seeding requires NODE_ENV to be explicitly set to development or test',
    );
  }
}

async function main() {
  assertSeedEnvironment(process.env.NODE_ENV);

  const adminEmail = process.env.CATCHUP_SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.CATCHUP_SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword?.trim()) {
    throw new Error(
      'CATCHUP_SEED_ADMIN_EMAIL and CATCHUP_SEED_ADMIN_PASSWORD must be set',
    );
  }

  const accounts = [
    { email: adminEmail, name: 'admin', password: adminPassword, role: 'ADMIN' },
    ...Array.from({ length: 4 }, (_, offset) => ({
      email: `host${offset + 2}@catchup.local`,
      name: `Mock Host ${offset + 2}`,
      password: crypto.randomBytes(18).toString('base64url'),
      role: 'HOST',
    })),
  ];

  for (const [offset, account] of accounts.entries()) {
    const index = offset + 1;
    const suffix = String(index);
    const userId = `seed-user-${suffix}`;
    const quizId = `seed-quiz-${suffix}`;
    const questionId = `seed-question-${suffix}`;
    const choiceId = `seed-choice-${suffix}`;
    const roomId = `seed-room-${suffix}`;
    const participantId = `seed-participant-${suffix}`;
    const attemptId = `seed-attempt-${suffix}`;
    const answerId = `seed-answer-${suffix}`;
    const passwordHash = await bcrypt.hash(account.password, 12);

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        isDisabled: false,
      },
      create: {
        id: userId,
        email: account.email,
        name: account.name,
        passwordHash,
        role: account.role,
        isDisabled: false,
      },
    });

    await prisma.quiz.upsert({
      where: { id: quizId },
      update: {
        title: `Mock Quiz ${suffix}`,
        description: `Seed quiz ${suffix}`,
        ownerId: userId,
      },
      create: {
        id: quizId,
        title: `Mock Quiz ${suffix}`,
        description: `Seed quiz ${suffix}`,
        ownerId: userId,
      },
    });

    await prisma.question.upsert({
      where: { id: questionId },
      update: {
        quizId,
        text: `Mock question ${suffix}?`,
        position: 1,
      },
      create: {
        id: questionId,
        quizId,
        text: `Mock question ${suffix}?`,
        position: 1,
      },
    });

    await prisma.choice.upsert({
      where: { id: choiceId },
      update: {
        questionId,
        text: `Mock answer ${suffix}`,
        isCorrect: true,
      },
      create: {
        id: choiceId,
        questionId,
        text: `Mock answer ${suffix}`,
        isCorrect: true,
      },
    });

    await prisma.room.upsert({
      where: { id: roomId },
      update: {
        code: `MOCK${suffix}`,
        quizId,
        hostId: userId,
        activityTitle: `Mock Quiz ${suffix}`,
        activityType: 'QUIZ',
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.REVEALED,
        currentQuestionIndex: 0,
        startedAt: new Date(`2026-08-0${suffix}T02:00:00.000Z`),
      },
      create: {
        id: roomId,
        code: `MOCK${suffix}`,
        quizId,
        hostId: userId,
        activityTitle: `Mock Quiz ${suffix}`,
        activityType: 'QUIZ',
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.REVEALED,
        currentQuestionIndex: 0,
        startedAt: new Date(`2026-08-0${suffix}T02:00:00.000Z`),
      },
    });

    await prisma.participant.upsert({
      where: { id: participantId },
      update: {
        roomId,
        displayName: `Player ${suffix}`,
        accessToken: `seed-token-${suffix}`,
      },
      create: {
        id: participantId,
        roomId,
        displayName: `Player ${suffix}`,
        accessToken: `seed-token-${suffix}`,
      },
    });

    await prisma.quizAttempt.upsert({
      where: { id: attemptId },
      update: {
        roomId,
        participantId,
        score: 100,
      },
      create: {
        id: attemptId,
        roomId,
        participantId,
        score: 100,
      },
    });

    await prisma.answer.upsert({
      where: { id: answerId },
      update: {
        attemptId,
        questionId,
        choiceId,
        isCorrect: true,
      },
      create: {
        id: answerId,
        attemptId,
        questionId,
        choiceId,
        isCorrect: true,
      },
    });
  }

  console.log('CatchUp development database seeded.\n\nAdmin:');
  console.log(`Email: ${adminEmail}`);
  console.log('Password: [loaded from CATCHUP_SEED_ADMIN_PASSWORD]');
  for (const [offset, account] of accounts.slice(1).entries()) {
    console.log(`\nMock Host ${offset + 2}:`);
    console.log(`Email: ${account.email}`);
    console.log(`Password: ${account.password}`);
  }
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { assertSeedEnvironment };
