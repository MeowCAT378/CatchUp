const { PrismaClient, RoomPhase, RoomStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const MIN_SEED_PASSWORD_LENGTH = 12;
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

  const seedPassword = process.env.CATCHUP_SEED_PASSWORD;
  if (
    typeof seedPassword !== 'string' ||
    seedPassword.trim().length < MIN_SEED_PASSWORD_LENGTH
  ) {
    throw new Error(
      `CATCHUP_SEED_PASSWORD must contain at least ${MIN_SEED_PASSWORD_LENGTH} non-whitespace characters`,
    );
  }

  const passwordHash = await bcrypt.hash(seedPassword, 12);

  for (let index = 1; index <= 5; index++) {
    const suffix = String(index);
    const userId = `seed-user-${suffix}`;
    const quizId = `seed-quiz-${suffix}`;
    const questionId = `seed-question-${suffix}`;
    const choiceId = `seed-choice-${suffix}`;
    const roomId = `seed-room-${suffix}`;
    const participantId = `seed-participant-${suffix}`;
    const attemptId = `seed-attempt-${suffix}`;
    const answerId = `seed-answer-${suffix}`;
    const isAdmin = index === 1;
    const email = isAdmin ? 'admin@admin.com' : `host${suffix}@catchup.local`;
    const name = isAdmin ? 'admin' : `Mock Host ${suffix}`;

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        name,
        passwordHash,
        role: 'HOST',
      },
      create: {
        id: userId,
        email,
        name,
        passwordHash,
        role: 'HOST',
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
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.REVEALED,
        currentQuestionIndex: 0,
      },
      create: {
        id: roomId,
        code: `MOCK${suffix}`,
        quizId,
        hostId: userId,
        status: RoomStatus.ACTIVE,
        phase: RoomPhase.REVEALED,
        currentQuestionIndex: 0,
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
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      console.log('Seeded 5 mock rows for every table.');
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { assertSeedEnvironment };
