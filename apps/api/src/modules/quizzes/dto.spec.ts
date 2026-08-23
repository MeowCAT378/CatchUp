import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateQuizDto } from './dto';

const validQuiz = {
  title: 'Quiz',
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
};

describe('quiz DTOs', () => {
  it('trims valid activity, question, and choice text', async () => {
    const dto = plainToInstance(CreateQuizDto, {
      ...validQuiz,
      title: '  Quiz  ',
      description: '  Description  ',
      questions: [
        {
          text: '  Question  ',
          choices: [
            { text: '  Correct  ', isCorrect: true },
            { text: '  Wrong  ', isCorrect: false },
          ],
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      title: 'Quiz',
      description: 'Description',
      questions: [
        {
          text: 'Question',
          choices: [{ text: 'Correct' }, { text: 'Wrong' }],
        },
      ],
    });
  });

  it.each([
    [{ ...validQuiz, title: ' ' }],
    [{ ...validQuiz, title: 'T'.repeat(151) }],
    [{ ...validQuiz, description: 'D'.repeat(2_001) }],
    [
      {
        ...validQuiz,
        questions: [{ ...validQuiz.questions[0], text: 'Q'.repeat(501) }],
      },
    ],
    [
      {
        ...validQuiz,
        questions: Array.from({ length: 101 }, () => validQuiz.questions[0]),
      },
    ],
    [
      {
        ...validQuiz,
        questions: [
          {
            ...validQuiz.questions[0],
            choices: Array.from({ length: 21 }, () => ({
              text: 'Choice',
              isCorrect: false,
            })),
          },
        ],
      },
    ],
    [
      {
        ...validQuiz,
        questions: [
          {
            ...validQuiz.questions[0],
            choices: [
              { text: 'C'.repeat(201), isCorrect: true },
              { text: 'Wrong', isCorrect: false },
            ],
          },
        ],
      },
    ],
  ])('rejects blank or oversized activity data', async (input) => {
    await expect(
      validate(plainToInstance(CreateQuizDto, input)),
    ).resolves.not.toHaveLength(0);
  });
});
