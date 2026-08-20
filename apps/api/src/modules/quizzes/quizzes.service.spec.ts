import { QuizzesService } from './quizzes.service';
describe('QuizzesService authorization', () => {
  it('rejects invalid nested quiz questions before writing', () => {
    const create = jest.fn();
    const service = new QuizzesService({ quiz: { create } } as never);
    expect(() =>
      service.create('owner', {
        title: 'Broken quiz',
        type: 'QUIZ',
        questions: [
          {
            text: 'Question',
            choices: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: true },
            ],
          },
        ],
      }),
    ).toThrow('Quizzes need exactly one correct choice');
    expect(create).not.toHaveBeenCalled();
  });

  it('duplicates owned quiz content without rooms or results', async () => {
    const create = jest.fn(() => Promise.resolve({ id: 'copy' }));
    const prisma = {
      quiz: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'quiz',
          title: 'Original',
          description: 'Description',
          type: 'QUIZ',
          ownerId: 'owner',
          questions: [
            {
              text: 'Question',
              position: 0,
              choices: [
                { text: 'A', isCorrect: true },
                { text: 'B', isCorrect: false },
              ],
            },
          ],
        }),
        create,
      },
    };
    await expect(
      new QuizzesService(prisma as never).duplicate('quiz', 'owner'),
    ).resolves.toEqual({ id: 'copy' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a teacher modifying another teacher quiz', async () => {
    const prisma = {
      quiz: {
        findUnique: jest.fn().mockResolvedValue({ id: 'q1', ownerId: 'owner' }),
        update: jest.fn(),
      },
    };
    await expect(
      new QuizzesService(prisma as never).update('q1', 'other', {
        title: 'Changed',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('does not rewrite questions used by room results', async () => {
    const prisma = {
      question: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'question',
          quiz: {
            ownerId: 'owner',
            type: 'QUIZ',
            _count: { rooms: 1 },
          },
        }),
      },
    };
    await expect(
      new QuizzesService(prisma as never).updateQuestion('question', 'owner', {
        text: 'Changed',
        choices: [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
        ],
      }),
    ).rejects.toMatchObject({ code: 'ACTIVITY_IN_USE' });
  });

  it('deletes only an owned activity', async () => {
    const remove = jest.fn().mockResolvedValue({ id: 'q1' });
    const removeRooms = jest.fn();
    const removeQuestions = jest.fn();
    const prisma = {
      quiz: {
        findUnique: jest.fn().mockResolvedValue({ id: 'q1', ownerId: 'owner' }),
        delete: remove,
      },
      room: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', code: '123456' }]),
        deleteMany: removeRooms,
      },
      question: {
        findMany: jest.fn().mockResolvedValue([{ id: 'question' }]),
        deleteMany: removeQuestions,
      },
      wordCloudVote: { deleteMany: jest.fn() },
      wordCloudEntry: { deleteMany: jest.fn() },
      answer: { deleteMany: jest.fn() },
      quizAttempt: { deleteMany: jest.fn() },
      participant: { deleteMany: jest.fn() },
      choice: { deleteMany: jest.fn() },
      $transaction: jest.fn((work: (tx: unknown) => unknown) => work(prisma)),
    };
    await expect(
      new QuizzesService(prisma as never).remove('q1', 'owner'),
    ).resolves.toEqual({ id: 'q1', rooms: [{ id: 'r1', code: '123456' }] });
    expect(removeRooms).toHaveBeenCalledWith({ where: { id: { in: ['r1'] } } });
    expect(removeQuestions).toHaveBeenCalledWith({
      where: { id: { in: ['question'] } },
    });
    expect(removeRooms.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(removeQuestions.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(remove).toHaveBeenCalledWith({ where: { id: 'q1' } });
    await expect(
      new QuizzesService(prisma as never).remove('q1', 'other'),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('blocks deleting a question after a room exists', async () => {
    const remove = jest.fn();
    const prisma = {
      question: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'question',
          quizId: 'quiz',
          position: 0,
          quiz: {
            ownerId: 'owner',
            type: 'QUIZ',
            _count: { rooms: 1 },
          },
        }),
        delete: remove,
      },
    };
    await expect(
      new QuizzesService(prisma as never).removeQuestion('question', 'owner'),
    ).rejects.toMatchObject({ code: 'ACTIVITY_IN_USE' });
    expect(remove).not.toHaveBeenCalled();
  });
});
