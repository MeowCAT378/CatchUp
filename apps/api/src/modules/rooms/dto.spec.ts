import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JoinRoomDto } from './dto';
describe('room DTOs', () => {
  it('accepts exactly six numeric digits and rejects other room codes', async () => {
    const valid = Object.assign(new JoinRoomDto(), {
      code: '482731',
      displayName: 'Player',
    });
    expect(await validate(valid)).toHaveLength(0);
    for (const code of ['A', 'ABC123', '12345', '1234567']) {
      const invalid = Object.assign(new JoinRoomDto(), {
        code,
        displayName: 'Player',
      });
      expect((await validate(invalid)).length).toBeGreaterThan(0);
    }
  });

  it('trims participant names and limits them to 40 characters', async () => {
    const trimmed = plainToInstance(JoinRoomDto, {
      code: '482731',
      displayName: '  Student  ',
    });
    expect(await validate(trimmed)).toHaveLength(0);
    expect(trimmed.displayName).toBe('Student');

    const tooLong = plainToInstance(JoinRoomDto, {
      code: '482731',
      displayName: 'x'.repeat(41),
    });
    expect((await validate(tooLong)).length).toBeGreaterThan(0);
  });
});
