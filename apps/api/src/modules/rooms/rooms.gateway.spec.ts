import { RoomsGateway, socketCorsOrigin } from './rooms.gateway';
import { RoomEvents } from './room-events';

describe('RoomsGateway CORS', () => {
  const originalOrigin = process.env.WEB_ORIGIN;

  afterEach(() => {
    if (originalOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = originalOrigin;
  });

  it('reads WEB_ORIGIN when the request is checked', () => {
    const callback = jest.fn();
    process.env.WEB_ORIGIN = 'https://first.example';
    socketCorsOrigin('https://first.example', callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);

    process.env.WEB_ORIGIN = 'https://second.example';
    socketCorsOrigin('https://first.example', callback);
    expect(callback).toHaveBeenLastCalledWith(null, false);
  });

  it('allows non-browser clients without broadening browser origins', () => {
    const callback = jest.fn();
    process.env.WEB_ORIGIN = 'https://web.example';
    socketCorsOrigin(undefined, callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);
    socketCorsOrigin('https://other.example', callback);
    expect(callback).toHaveBeenLastCalledWith(null, false);
  });
});

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
      to: jest.fn().mockReturnValue({ emit }),
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
    expect(client.emit).toHaveBeenCalledWith(RoomEvents.state, {
      activityType: 'WORD_CLOUD',
    });
    expect(emit).toHaveBeenCalledWith(RoomEvents.wordCloudUpdated, {
      activityType: 'WORD_CLOUD',
    });
    expect(emit).toHaveBeenCalledWith(RoomEvents.dashboardUpdated, {
      roomId: 'room-1',
      connected: 0,
    });
  });
});
