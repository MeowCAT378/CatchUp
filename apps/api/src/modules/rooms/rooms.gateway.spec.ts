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

describe('RoomsGateway trusted client address', () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
  });

  const addressFrom = (gateway: RoomsGateway, forwardedFor: string) =>
    (
      gateway as unknown as {
        clientAddress(client: unknown): string;
      }
    ).clientAddress({
      handshake: {
        address: '10.0.0.9',
        headers: { 'x-forwarded-for': forwardedFor },
      },
    });

  it('ignores a forwarded address when no proxy is trusted', () => {
    process.env.TRUST_PROXY_HOPS = '0';
    const gateway = new RoomsGateway({} as never, {} as never);

    expect(addressFrom(gateway, '203.0.113.1')).toBe('10.0.0.9');
  });

  it('uses the same configured proxy chain as HTTP', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    const gateway = new RoomsGateway({} as never, {} as never);

    expect(addressFrom(gateway, '198.51.100.8, 10.0.0.1')).toBe('198.51.100.8');
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
      handshake: { address: '127.0.0.1' },
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

describe('RoomsGateway event errors', () => {
  it('returns FORBIDDEN for participant identity mismatches', async () => {
    const gateway = new RoomsGateway({} as never, {} as never);
    const client = {
      data: {
        role: 'participant',
        code: '123456',
        participantId: 'player',
        participantToken: 'token',
      },
      emit: jest.fn(),
    };

    await gateway.answer(client as never, {
      code: '123456',
      participantId: 'other-player',
      participantToken: 'token',
      choiceId: 'choice',
    });

    expect(client.emit).toHaveBeenCalledWith(RoomEvents.error, {
      code: 'FORBIDDEN',
    });
  });

  it('returns VALIDATION_ERROR for malformed participant events', async () => {
    const submit = jest.fn();
    const gateway = new RoomsGateway({ submit } as never, {} as never);
    const client = {
      data: {
        role: 'participant',
        code: '123456',
        participantId: 'player',
        participantToken: 'token',
      },
      emit: jest.fn(),
    };

    await gateway.answer(client as never, undefined);

    expect(client.emit).toHaveBeenCalledWith(RoomEvents.error, {
      code: 'VALIDATION_ERROR',
    });
    expect(submit).not.toHaveBeenCalled();
  });
});

describe('RoomsGateway host token revocation', () => {
  it('normalizes and stores the JWT token version at connection', () => {
    const gateway = new RoomsGateway(
      {} as never,
      {
        verify: jest.fn().mockReturnValue({ sub: 'host' }),
      } as never,
    );
    const client = {
      handshake: { auth: { token: 'legacy-token' } },
      data: {},
      disconnect: jest.fn(),
    };

    gateway.handleConnection(client as never);

    expect(client.data).toEqual({ userId: 'host', tokenVersion: 0 });
  });

  it('passes the connected token version during the initial host join', async () => {
    const socketAccess = jest.fn().mockRejectedValue(new Error('stale'));
    const gateway = new RoomsGateway({ socketAccess } as never, {} as never);
    const client = {
      id: 'socket',
      handshake: { address: '127.0.0.1' },
      data: { userId: 'host', tokenVersion: 2 },
      emit: jest.fn(),
      leave: jest.fn(),
    };

    await gateway.join(client as never, { code: '123456' });

    expect(socketAccess).toHaveBeenCalledWith(
      '123456',
      undefined,
      undefined,
      'host',
      2,
    );
  });

  it('passes the connected token version through every host event wrapper', async () => {
    const socketAccess = jest.fn().mockRejectedValue(new Error('stale'));
    const gateway = new RoomsGateway({ socketAccess } as never, {} as never);
    const client = {
      handshake: { address: '127.0.0.1' },
      data: {
        role: 'host',
        code: '123456',
        userId: 'host',
        tokenVersion: 3,
      },
      emit: jest.fn(),
    };

    await gateway.questionStart(client as never, { code: '123456' });

    expect(socketAccess).toHaveBeenCalledWith(
      '123456',
      undefined,
      undefined,
      'host',
      3,
    );
    expect(client.emit).toHaveBeenCalledWith(RoomEvents.error, {
      code: 'REQUEST_FAILED',
    });
  });
});
