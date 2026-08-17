import { RoomsGateway } from './rooms.gateway';
import { RoomEvents } from './room-events';

describe('RoomsGateway word cloud updates', () => {
  it('broadcasts the persisted aggregation and refreshes the host dashboard', async () => {
    const rooms = {
      submitWord: jest.fn().mockResolvedValue([]),
      state: jest.fn().mockResolvedValue({ activityType: 'WORD_CLOUD' }),
      dashboardState: jest.fn().mockResolvedValue({ roomId: 'room-1' }),
    };
    const gateway = new RoomsGateway(rooms as never, {} as never);
    const emit = jest.fn();
    gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;
    const client = {
      data: {
        role: 'participant',
        code: '123456',
        participantId: 'player',
        participantToken: 'token',
      },
      emit: jest.fn(),
    };

    await gateway.wordCloudSubmit(client as never, {
      code: '123456',
      participantId: 'player',
      participantToken: 'token',
      text: 'CatchUp',
    });

    expect(rooms.submitWord).toHaveBeenCalledWith(
      '123456',
      'player',
      'token',
      'CatchUp',
    );
    expect(emit).toHaveBeenCalledWith(RoomEvents.wordCloudUpdated, {
      activityType: 'WORD_CLOUD',
    });
    expect(emit).toHaveBeenCalledWith(RoomEvents.dashboardUpdated, {
      roomId: 'room-1',
      connected: 0,
    });
  });
});
