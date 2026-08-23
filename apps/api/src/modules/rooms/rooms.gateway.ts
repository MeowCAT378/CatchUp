import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AppError } from '../../common/app-error';
import { RoomsService } from './rooms.service';
import { RoomEvents } from './room-events';
import { checkRateLimit } from '../../common/rate-limit';
import {
  parseTrustProxyHops,
  trustedClientAddress,
} from '../../common/network/trusted-client-address';
type SocketData = {
  userId?: string;
  code?: string;
  participantId?: string;
  participantToken?: string;
  role?: 'host' | 'participant';
};
const roomCode = /^\d{6}$/;
const stringPayload = (
  value: unknown,
  fields: readonly string[],
): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  fields.every(
    (field) => typeof (value as Record<string, unknown>)[field] === 'string',
  );
const invalidPayload = () =>
  new AppError('VALIDATION_ERROR', 400, 'Invalid Socket event payload');

export const socketCorsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) => {
  const configuredOrigin =
    process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';
  callback(null, origin === undefined || origin === configuredOrigin);
};

@WebSocketGateway({
  namespace: '/rooms',
  cors: { origin: socketCorsOrigin },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Namespace;
  private readonly presence = new Map<string, Set<string>>();
  private readonly trustedProxyHops = parseTrustProxyHops(
    process.env.TRUST_PROXY_HOPS,
  );
  constructor(
    private readonly rooms: RoomsService,
    private readonly jwt: JwtService,
  ) {}
  handleConnection(client: Socket) {
    const token = client.handshake.auth.token as string | undefined;
    if (!token) return;
    try {
      (client.data as SocketData).userId = this.jwt.verify<{ sub: string }>(
        token,
      ).sub;
    } catch {
      client.disconnect();
    }
  }
  async handleDisconnect(client: Socket) {
    await this.leave(client);
  }
  @SubscribeMessage(RoomEvents.join) async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    try {
      const raw = payload as Record<string, unknown>;
      if (
        !stringPayload(payload, ['code']) ||
        !roomCode.test(payload.code) ||
        (raw.participantId !== undefined &&
          typeof raw.participantId !== 'string') ||
        (raw.participantToken !== undefined &&
          typeof raw.participantToken !== 'string')
      )
        throw invalidPayload();
      await this.leave(client);
      checkRateLimit(`socket-join:${this.clientAddress(client)}`, 300, 60_000);
      const access = await this.rooms.socketAccess(
        payload.code,
        payload.participantId,
        payload.participantToken,
        (client.data as SocketData).userId,
      );
      const data = client.data as SocketData;
      data.code = access.code;
      data.role = access.role;
      data.participantId =
        access.role === 'participant' ? access.participantId : undefined;
      data.participantToken =
        access.role === 'participant' ? payload.participantToken : undefined;
      await client.join(this.group(access.code));
      if (access.role === 'host')
        await client.join(this.hostGroup(access.code));
      else {
        const key = `${access.roomId}:${access.participantId}`;
        const sockets = this.presence.get(key) ?? new Set<string>();
        const first = sockets.size === 0;
        sockets.add(client.id);
        this.presence.set(key, sockets);
        if (first)
          client
            .to(this.group(access.code))
            .emit(RoomEvents.participantJoined, {
              participantId: access.participantId,
              displayName: access.displayName,
            });
      }
      client.emit(
        RoomEvents.state,
        await this.rooms.state(
          access.code,
          data.participantId,
          data.participantToken,
        ),
      );
      await this.dashboard(access.code);
    } catch (error) {
      this.error(client, error);
    }
  }
  @SubscribeMessage(RoomEvents.leave) async leaveEvent(
    @ConnectedSocket() client: Socket,
  ) {
    await this.leave(client);
  }
  @SubscribeMessage(RoomEvents.quizStart) async start(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.host(client, body, async (code) => {
      await this.rooms.start(code, (client.data as SocketData).userId!);
      const state = await this.rooms.state(code);
      this.server.to(this.group(code)).emit(RoomEvents.quizStarted, state);
      this.server.to(this.group(code)).emit(RoomEvents.questionStarted, state);
    });
  }
  @SubscribeMessage(RoomEvents.questionStart) async questionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.host(client, body, async (code) => {
      const state = await this.rooms.state(code);
      this.server.to(this.group(code)).emit(RoomEvents.questionStarted, state);
    });
  }
  @SubscribeMessage(RoomEvents.answerSubmit) async answer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      if (
        !stringPayload(body, [
          'code',
          'participantId',
          'participantToken',
          'choiceId',
        ]) ||
        !roomCode.test(body.code)
      )
        throw invalidPayload();
      const data = client.data as SocketData;
      if (
        data.role !== 'participant' ||
        data.code !== body.code ||
        data.participantId !== body.participantId ||
        data.participantToken !== body.participantToken
      )
        throw new ForbiddenException();
      checkRateLimit(
        `socket-action-address:${this.clientAddress(client)}`,
        600,
        10_000,
      );
      checkRateLimit(`socket-participant:${data.participantId}`, 30, 10_000);
      await this.rooms.submit(
        body.code,
        body.participantId,
        body.participantToken,
        body.choiceId,
      );
      client.emit(
        RoomEvents.state,
        await this.rooms.state(
          body.code,
          body.participantId,
          body.participantToken,
        ),
      );
      await this.dashboard(body.code);
    } catch (error) {
      this.error(client, error);
    }
  }
  @SubscribeMessage(RoomEvents.wordCloudSubmit) async wordCloudSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.wordCloud(client, body, 'text', (payload) =>
      this.rooms.submitWord(
        payload.code,
        payload.participantId,
        payload.participantToken,
        payload.text,
      ),
    );
  }
  @SubscribeMessage(RoomEvents.wordCloudVote) async wordCloudVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.wordCloud(client, body, 'entryId', (payload) =>
      this.rooms.voteWord(
        payload.code,
        payload.participantId,
        payload.participantToken,
        payload.entryId,
      ),
    );
  }
  @SubscribeMessage(RoomEvents.questionReveal) async reveal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.host(client, body, async (code) => {
      const revealed = await this.rooms.reveal(
        code,
        (client.data as SocketData).userId!,
      );
      this.server.to(this.group(code)).emit(RoomEvents.questionRevealed, {
        ...(await this.rooms.state(code)),
        correctChoiceId: revealed.correctChoiceId,
      });
      this.server
        .to(this.group(code))
        .emit(RoomEvents.leaderboardUpdated, await this.rooms.result(code));
    });
  }
  @SubscribeMessage(RoomEvents.questionNext) async next(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.host(client, body, async (code) => {
      const room = await this.rooms.next(
        code,
        (client.data as SocketData).userId!,
      );
      if (room.status === 'FINISHED') {
        this.server
          .to(this.group(code))
          .emit(RoomEvents.state, await this.rooms.state(code));
        this.server
          .to(this.group(code))
          .emit(RoomEvents.quizCompleted, await this.rooms.result(code));
      } else
        this.server
          .to(this.group(code))
          .emit(RoomEvents.questionStarted, await this.rooms.state(code));
    });
  }
  @SubscribeMessage(RoomEvents.quizComplete) async complete(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    await this.host(client, body, async (code) => {
      await this.rooms.complete(code, (client.data as SocketData).userId!);
      this.server
        .to(this.group(code))
        .emit(RoomEvents.state, await this.rooms.state(code));
      this.server
        .to(this.group(code))
        .emit(RoomEvents.quizCompleted, await this.rooms.result(code));
    });
  }
  disconnectHost(userId: string) {
    for (const socket of this.server.sockets.values())
      if ((socket.data as SocketData).userId === userId)
        socket.disconnect(true);
  }
  private async host(
    client: Socket,
    body: unknown,
    action: (code: string) => Promise<void>,
  ) {
    try {
      if (!stringPayload(body, ['code']) || !roomCode.test(body.code))
        throw invalidPayload();
      const code = body.code;
      const data = client.data as SocketData;
      if (data.role !== 'host' || data.code !== code)
        throw new ForbiddenException();
      checkRateLimit(`socket-host:${data.userId}:${code}`, 20, 10_000);
      await this.rooms.socketAccess(code, undefined, undefined, data.userId);
      await action(code);
      await this.dashboard(code);
    } catch (error) {
      this.error(client, error);
    }
  }
  private async wordCloud(
    client: Socket,
    body: unknown,
    valueField: 'text' | 'entryId',
    action: (payload: Record<string, string>) => Promise<unknown>,
  ) {
    try {
      if (
        !stringPayload(body, [
          'code',
          'participantId',
          'participantToken',
          valueField,
        ]) ||
        !roomCode.test(body.code)
      )
        throw invalidPayload();
      const data = client.data as SocketData;
      if (
        data.role !== 'participant' ||
        data.code !== body.code ||
        data.participantId !== body.participantId ||
        data.participantToken !== body.participantToken
      )
        throw new ForbiddenException();
      checkRateLimit(
        `socket-action-address:${this.clientAddress(client)}`,
        600,
        10_000,
      );
      checkRateLimit(`socket-participant:${data.participantId}`, 30, 10_000);
      await action(body);
      client.emit(
        RoomEvents.state,
        await this.rooms.state(
          body.code,
          body.participantId,
          body.participantToken,
        ),
      );
      client
        .to(this.group(body.code))
        .emit(RoomEvents.wordCloudUpdated, await this.rooms.state(body.code));
      await this.dashboard(body.code);
    } catch (error) {
      this.error(client, error);
    }
  }
  private async leave(client: Socket) {
    const data = client.data as SocketData;
    if (
      !data.code ||
      data.role !== 'participant' ||
      !data.participantId ||
      !data.participantToken
    )
      return;
    const code = data.code;
    const access = await this.rooms
      .socketAccess(code, data.participantId, data.participantToken)
      .catch(() => undefined);
    const key = access ? `${access.roomId}:${data.participantId}` : '';
    const sockets = this.presence.get(key);
    if (sockets) {
      sockets.delete(client.id);
      if (!sockets.size) {
        this.presence.delete(key);
        client.to(this.group(code)).emit(RoomEvents.participantLeft, {
          participantId: data.participantId,
        });
      }
    }
    await client.leave(this.group(code));
    data.code = undefined;
    await this.dashboard(code).catch(() => undefined);
  }
  private async dashboard(code: string) {
    const dashboard = await this.rooms.dashboardState(code);
    const connected = [...this.presence.keys()].filter((key) =>
      key.startsWith(`${dashboard.roomId}:`),
    ).length;
    this.server
      .to(this.hostGroup(code))
      .emit(RoomEvents.dashboardUpdated, { ...dashboard, connected });
  }
  private group(code: string) {
    return `room:${code}`;
  }
  private hostGroup(code: string) {
    return `room:${code}:hosts`;
  }
  private clientAddress(client: Socket) {
    return trustedClientAddress(
      client.handshake.address,
      client.handshake.headers?.['x-forwarded-for'],
      this.trustedProxyHops,
    );
  }
  private error(client: Socket, error: unknown) {
    const code =
      error instanceof AppError
        ? error.code
        : error instanceof ForbiddenException
          ? 'FORBIDDEN'
          : 'REQUEST_FAILED';
    client.emit(RoomEvents.error, { code });
  }
}
