import { QuizzesService } from './quizzes.service';
describe('QuizzesService authorization', () => {
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

  it('deletes a question regardless of responses', async () => {
    const remove = jest.fn();
    const prisma = {
      question: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'question',
            quizId: 'quiz',
            position: 0,
            quiz: { ownerId: 'owner' },
          }),
        delete: remove,
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((work: unknown) =>
        Array.isArray(work)
          ? Promise.all(work)
          : (work as (tx: unknown) => unknown)(prisma),
      ),
    };
    await expect(
      new QuizzesService(prisma as never).removeQuestion('question', 'owner'),
    ).resolves.toEqual({ id: 'question' });
    expect(remove).toHaveBeenCalledWith({ where: { id: 'question' } });
  });
});
