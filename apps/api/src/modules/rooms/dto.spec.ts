import { validate } from 'class-validator'; import { JoinRoomDto } from './dto';
describe('room DTOs', () => { it('rejects invalid join payloads', async () => { const dto = Object.assign(new JoinRoomDto(), { code: 'A', displayName: 'X' }); expect((await validate(dto)).length).toBeGreaterThan(0); }); });
