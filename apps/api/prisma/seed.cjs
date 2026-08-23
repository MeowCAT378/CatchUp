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
  const kazumaPassword = process.env.CATCHUP_SEED_KAZUMA_PASSWORD;
  if (!adminEmail || !adminPassword?.trim()) {
    throw new Error(
      'CATCHUP_SEED_ADMIN_EMAIL and CATCHUP_SEED_ADMIN_PASSWORD must be set',
    );
  }
  if (!kazumaPassword?.trim()) {
    throw new Error('CATCHUP_SEED_KAZUMA_PASSWORD must be set');
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

  const kazuma = await prisma.user.upsert({
    where: { email: 'kazama@test.com' },
    update: {
      name: 'Kazuma Kiryu',
      passwordHash: await bcrypt.hash(kazumaPassword, 12),
      role: 'HOST',
      isDisabled: false,
    },
    create: {
      id: 'seed-user-kazuma-kiryu',
      email: 'kazama@test.com',
      name: 'Kazuma Kiryu',
      passwordHash: await bcrypt.hash(kazumaPassword, 12),
      role: 'HOST',
      isDisabled: false,
    },
  });
  const activities = [
    {
      id: 'seed-kazuma-quiz',
      title: 'English General Knowledge Quiz',
      description: 'A ready-to-play English quiz for the classroom.',
      type: 'QUIZ',
      questions: [
        ['Which planet is known as the Red Planet?', [['Mars', true], ['Venus', false], ['Jupiter', false], ['Mercury', false]]],
        ['What is the largest ocean on Earth?', [['Pacific Ocean', true], ['Atlantic Ocean', false], ['Indian Ocean', false], ['Arctic Ocean', false]]],
        ['Who wrote Romeo and Juliet?', [['William Shakespeare', true], ['Charles Dickens', false], ['Jane Austen', false], ['Mark Twain', false]]],
      ],
    },
    {
      id: 'seed-kazuma-poll-1',
      title: 'Classroom Preferences Poll',
      description: 'A ready-to-play English poll about classroom preferences.',
      type: 'POLL',
      questions: [
        ['Which activity helps you learn best?', [['Group discussion', false], ['Practice quiz', false], ['Watching a video', false], ['Reading quietly', false]]],
        ['What time do you prefer for a class break?', [['10 minutes', false], ['15 minutes', false], ['20 minutes', false], ['No preference', false]]],
      ],
    },
    {
      id: 'seed-kazuma-poll-2',
      title: 'Weekend Plans Poll',
      description: 'A ready-to-play English poll about weekend plans.',
      type: 'POLL',
      questions: [
        ['What is your favorite weekend activity?', [['Playing sports', false], ['Watching movies', false], ['Reading books', false], ['Meeting friends', false]]],
        ['Where would you most like to travel?', [['A beach', false], ['A mountain', false], ['A city', false], ['A national park', false]]],
      ],
    },
  ];

  for (const activity of activities) {
    const { questions, ...activityData } = activity;
    await prisma.quiz.upsert({
      where: { id: activity.id },
      update: { ...activityData, ownerId: kazuma.id, deletedAt: null },
      create: { ...activityData, ownerId: kazuma.id },
    });
    for (const [position, [text, choices]] of questions.entries()) {
      const question = await prisma.question.upsert({
        where: { quizId_position: { quizId: activity.id, position } },
        update: { quizId: activity.id, text, position },
        create: { quizId: activity.id, text, position },
      });
      const questionId = question.id;
      for (const [choiceIndex, [choiceText, isCorrect]] of choices.entries()) {
        const choiceId = `${questionId}-choice-${choiceIndex + 1}`;
        await prisma.choice.upsert({
          where: { id: choiceId },
          update: { questionId, text: choiceText, isCorrect },
          create: { id: choiceId, questionId, text: choiceText, isCorrect },
        });
      }
    }
  }

  console.log('CatchUp development database seeded.\n\nAdmin:');
  console.log(`Email: ${adminEmail}`);
  console.log('Password: [loaded from CATCHUP_SEED_ADMIN_PASSWORD]');
  console.log('\nMock host passwords are generated and not disclosed.');
  console.log('\nKazuma Kiryu:');
  console.log('Email: kazama@test.com');
  console.log('Password: [loaded from CATCHUP_SEED_KAZUMA_PASSWORD]');
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
