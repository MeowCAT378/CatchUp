import { escapeCsvCell, sanitizeSpreadsheetCell } from './room-export.service';
describe('spreadsheet escaping', () => {
  it.each([
    '=1+1',
    '+cmd',
    '-10',
    '@SUM(A1)',
    '  =1+1',
    '\t@SUM(A1)',
    '\r-cmd',
  ])('sanitizes formula prefixes', (value) => {
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
  });
  it('preserves non-formula text that starts with an asterisk', () => {
    expect(sanitizeSpreadsheetCell('*safe')).toBe('*safe');
  });
  it('preserves Thai Unicode', () => {
    expect(sanitizeSpreadsheetCell('ไทย')).toBe('ไทย');
  });
  it('escapes commas, quotes, and line breaks', () => {
    expect(escapeCsvCell('a,"b"\nไทย')).toBe('"a,""b""\nไทย"');
  });
});
