import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import type { AuthUser } from '../../common/auth/auth-user';
import { RoomResultsService } from './room-results.service';
type ResultData = Awaited<ReturnType<RoomResultsService['results']>>;
export const sanitizeSpreadsheetCell = (
  value: string | number | boolean | null | undefined,
) => {
  const text = String(value ?? '');
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    const code = text.charCodeAt(index);
    if (!/\s/.test(character) && code > 31 && code !== 127) break;
    index += 1;
  }
  const marker = text[index];
  return marker !== undefined && '=+-@'.includes(marker) ? `'${text}` : text;
};
export const escapeCsvCell = (
  value: string | number | boolean | null | undefined,
) => `"${sanitizeSpreadsheetCell(value).replaceAll('"', '""')}"`;
const safe = sanitizeSpreadsheetCell;
const csv = escapeCsvCell;
@Injectable()
export class RoomExportService {
  constructor(private readonly results: RoomResultsService) {}
  async csv(code: string, viewer: AuthUser | string) {
    return this.csvData(await this.results.results(code, viewer));
  }
  async csvById(id: string, viewer: AuthUser | string) {
    return this.csvData(await this.results.resultsById(id, viewer));
  }
  private csvData(data: ResultData) {
    const isQuiz = data.room.activityType === 'QUIZ';
    const isWordCloud = data.room.activityType === 'WORD_CLOUD';
    const rows: unknown[][] = [
      ['Activity title', data.room.quizTitle],
      ['Activity type', data.room.activityType],
      ['Teacher', data.room.teacher.name ?? data.room.teacher.email],
      ['Session ID', data.room.id],
      ['Room code', data.room.code],
      ['Started at', data.room.startedAt?.toISOString() ?? ''],
      ['Ended at', data.room.endedAt?.toISOString() ?? ''],
      ['Exported at', new Date().toISOString()],
      ['Participants', data.summary.totalParticipants],
      ...(isQuiz ? [['Average score', data.summary.averageScore]] : []),
      ['Completion rate', `${data.summary.completionRate}%`],
      [],
      [
        'Rank',
        'Participant',
        ...(isQuiz ? ['Score'] : []),
        'Answered',
        ...(isQuiz ? ['Correct', 'Incorrect'] : []),
        'Completion %',
      ],
      ...data.participants.map((p) => [
        p.rank,
        p.name,
        ...(isQuiz ? [p.score] : []),
        p.answeredCount,
        ...(isQuiz ? [p.correctCount, p.incorrectCount] : []),
        `${data.questions.length ? Math.round((p.answeredCount / data.questions.length) * 100) : 0}%`,
      ]),
      [],
      ...(isWordCloud
        ? [
            ['Word', 'Submission count', 'Vote count'],
            ...data.questions.flatMap((question) =>
              question.words.map((word) => [
                word.text,
                word.submissionCount,
                word.voteCount,
              ]),
            ),
          ]
        : [
            [
              'Participant',
              'Question',
              'Selected answer',
              ...(isQuiz ? ['Correct answer', 'Correct', 'Score awarded'] : []),
            ],
            ...data.responses.map((response) => [
              response.participant,
              response.question,
              response.selectedAnswer,
              ...(isQuiz
                ? [
                    response.correctAnswer,
                    response.correct ? 'Yes' : 'No',
                    response.scoreAwarded,
                  ]
                : []),
            ]),
          ]),
    ];
    return Buffer.from(
      `\ufeff${rows.map((row) => row.map(csv).join(',')).join('\r\n')}`,
      'utf8',
    );
  }
  async xlsx(code: string, viewer: AuthUser | string) {
    return this.xlsxData(await this.results.results(code, viewer));
  }
  async xlsxById(id: string, viewer: AuthUser | string) {
    return this.xlsxData(await this.results.resultsById(id, viewer));
  }
  private async xlsxData(data: ResultData) {
    const isQuiz = data.room.activityType === 'QUIZ';
    const isWordCloud = data.room.activityType === 'WORD_CLOUD';
    const book = new ExcelJS.Workbook();
    book.creator = 'CatchUp';
    const header = (sheet: ExcelJS.Worksheet, values: string[]) => {
      const row = sheet.addRow(values);
      row.font = { bold: true };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    };
    const summary = book.addWorksheet('Summary');
    summary.addRows([
      ['Activity title', safe(data.room.quizTitle)],
      ['Activity type', data.room.activityType],
      ['Teacher', safe(data.room.teacher.name ?? data.room.teacher.email)],
      ['Session ID', data.room.id],
      ['Room code', data.room.code],
      ['Room status', data.room.phase],
      ['Started at', data.room.startedAt ?? ''],
      ['Ended at', data.room.endedAt ?? ''],
      ['Participant count', data.summary.totalParticipants],
      ['Total responses', data.summary.totalSubmittedAnswers],
      ['Completion rate', data.summary.completionRate / 100],
      ...(isQuiz
        ? [
            ['Average score', data.summary.averageScore],
            ['Highest score', data.summary.highestScore],
            ['Lowest score', data.summary.lowestScore],
          ]
        : []),
    ]);
    summary.getColumn(1).width = 22;
    summary.getColumn(2).width = 42;
    summary.getCell('A1').font = { bold: true };
    summary.getColumn(2).numFmt = 'General';
    summary.getCell('B11').numFmt = '0.0%';
    const participants = book.addWorksheet('Leaderboard');
    header(participants, [
      'Rank',
      'Participant',
      ...(isQuiz ? ['Score'] : []),
      'Answered',
      ...(isQuiz ? ['Correct', 'Incorrect'] : []),
      'Completion %',
    ]);
    data.participants.forEach((p) =>
      participants.addRow([
        p.rank,
        safe(p.name),
        ...(isQuiz ? [p.score] : []),
        p.answeredCount,
        ...(isQuiz ? [p.correctCount, p.incorrectCount] : []),
        data.questions.length ? p.answeredCount / data.questions.length : 0,
      ]),
    );
    participants.columns = isQuiz
      ? [
          { width: 10 },
          { width: 28 },
          { width: 12 },
          { width: 12 },
          { width: 12 },
          { width: 12 },
          { width: 16 },
        ]
      : [{ width: 10 }, { width: 28 }, { width: 12 }, { width: 16 }];
    participants.getColumn(isQuiz ? 7 : 4).numFmt = '0.0%';
    const questions = book.addWorksheet('Questions');
    header(questions, [
      'Question #',
      'Question',
      'Responses',
      'Unanswered',
      ...(isQuiz
        ? ['Correct', 'Incorrect', 'Correct %', 'Correct answer']
        : []),
    ]);
    data.questions.forEach((q, i) =>
      questions.addRow([
        i + 1,
        safe(q.text),
        q.responseCount,
        q.unansweredCount,
        ...(isQuiz
          ? [
              q.correctCount,
              q.incorrectCount,
              q.correctPercentage / 100,
              q.correctChoiceId
                ? safe(
                    q.distribution.find(
                      (choice) => choice.choiceId === q.correctChoiceId,
                    )?.text,
                  )
                : '',
            ]
          : []),
      ]),
    );
    questions.columns = [
      { width: 12 },
      { width: 46 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 32 },
    ];
    if (isQuiz) questions.getColumn(7).numFmt = '0.0%';
    const distribution = book.addWorksheet('Answer Distribution');
    header(distribution, [
      'Question #',
      'Question',
      'Option',
      'Responses',
      'Percentage',
      ...(isQuiz ? ['Correct'] : []),
    ]);
    data.questions.forEach((q, i) =>
      q.distribution.forEach((choice) =>
        distribution.addRow([
          i + 1,
          safe(q.text),
          safe(choice.text),
          choice.count,
          q.responseCount ? choice.count / q.responseCount : 0,
          ...(isQuiz
            ? [
                choice.isCorrect === undefined
                  ? ''
                  : choice.isCorrect
                    ? 'Yes'
                    : 'No',
              ]
            : []),
        ]),
      ),
    );
    distribution.columns = [
      { width: 12 },
      { width: 42 },
      { width: 32 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
    ];
    distribution.getColumn(5).numFmt = '0.0%';
    if (isWordCloud) {
      const words = book.addWorksheet('Words');
      header(words, ['Word', 'Submission count', 'Vote count']);
      data.questions.forEach((question) =>
        question.words.forEach((word) =>
          words.addRow([safe(word.text), word.submissionCount, word.voteCount]),
        ),
      );
      words.columns = [{ width: 38 }, { width: 20 }, { width: 14 }];
    } else {
      const responses = book.addWorksheet('Responses');
      header(responses, [
        'Participant',
        'Question',
        'Selected answer',
        ...(isQuiz ? ['Correct answer', 'Correct', 'Score awarded'] : []),
        'Submitted at',
      ]);
      data.responses.forEach((response) =>
        responses.addRow([
          safe(response.participant),
          safe(response.question),
          safe(response.selectedAnswer),
          ...(isQuiz
            ? [
                safe(response.correctAnswer),
                response.correct ? 'Yes' : 'No',
                response.scoreAwarded,
              ]
            : []),
          response.submittedAt,
        ]),
      );
      responses.columns = [
        { width: 28 },
        { width: 46 },
        { width: 32 },
        { width: 32 },
        { width: 12 },
        { width: 16 },
        { width: 24 },
      ];
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
