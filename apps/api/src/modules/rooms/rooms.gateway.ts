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
import type { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';
import { RoomEvents } from './room-events';
import type { AnswerSubmitPayload, RoomJoinPayload } from './room-events';
type SocketData = {
  userId?: string;
  code?: string;
  participantId?: string;
  participantToken?: string;
  role?: 'host' | 'participant';
};
@WebSocketGateway({
  namespace: '/rooms',
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001' },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly presence = new Map<string, Set<string>>();
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
    @MessageBody() payload: RoomJoinPayload,
  ) {
    try {
      await this.leave(client);
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
      client.join(this.group(access.code));
      if (access.role === 'host') client.join(this.hostGroup(access.code));
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
    @MessageBody() body: { code: string },
  ) {
    await this.host(client, body.code, async () => {
      await this.rooms.start(body.code, (client.data as SocketData).userId!);
      const state = await this.rooms.state(body.code);
      this.server.to(this.group(body.code)).emit(RoomEvents.quizStarted, state);
      this.server
        .to(this.group(body.code))
        .emit(RoomEvents.questionStarted, state);
    });
  }
  @SubscribeMessage(RoomEvents.questionStart) async questionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string },
  ) {
    await this.host(client, body.code, async () => {
      const state = await this.rooms.state(body.code);
      this.server
        .to(this.group(body.code))
        .emit(RoomEvents.questionStarted, state);
    });
  }
  @SubscribeMessage(RoomEvents.answerSubmit) async answer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: AnswerSubmitPayload,
  ) {
    try {
      const data = client.data as SocketData;
      if (
        data.role !== 'participant' ||
        data.code !== body.code ||
        data.participantId !== body.participantId ||
        data.participantToken !== body.participantToken
      )
        throw new ForbiddenException();
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
      this.server
        .to(this.hostGroup(body.code))
        .emit(RoomEvents.answerProgress, await this.rooms.progress(body.code));
      await this.dashboard(body.code);
    } catch (error) {
      this.error(client, error);
    }
  }
  @SubscribeMessage(RoomEvents.questionReveal) async reveal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string },
  ) {
    await this.host(client, body.code, async () => {
      const revealed = await this.rooms.reveal(
        body.code,
        (client.data as SocketData).userId!,
      );
      this.server
        .to(this.group(body.code))
        .emit(RoomEvents.questionRevealed, {
          ...(await this.rooms.state(body.code)),
          correctChoiceId: revealed.correctChoiceId,
        });
      this.server
        .to(this.group(body.code))
        .emit(
          RoomEvents.leaderboardUpdated,
          await this.rooms.result(body.code),
        );
    });
  }
  @SubscribeMessage(RoomEvents.questionNext) async next(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string },
  ) {
    await this.host(client, body.code, async () => {
      const room = await this.rooms.next(
        body.code,
        (client.data as SocketData).userId!,
      );
      if (room.status === 'FINISHED')
        this.server
          .to(this.group(body.code))
          .emit(RoomEvents.quizCompleted, await this.rooms.result(body.code));
      else
        this.server
          .to(this.group(body.code))
          .emit(RoomEvents.questionStarted, await this.rooms.state(body.code));
    });
  }
  @SubscribeMessage(RoomEvents.quizComplete) async complete(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { code: string },
  ) {
    await this.host(client, body.code, async () => {
      await this.rooms.complete(body.code, (client.data as SocketData).userId!);
      this.server
        .to(this.group(body.code))
        .emit(RoomEvents.quizCompleted, await this.rooms.result(body.code));
      await this.dashboard(body.code);
    });
  }
  private async host(
    client: Socket,
    code: string,
    action: () => Promise<void>,
  ) {
    try {
      const data = client.data as SocketData;
      if (data.role !== 'host' || data.code !== code)
        throw new ForbiddenException();
      await action();
      await this.dashboard(code);
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
        client
          .to(this.group(code))
          .emit(RoomEvents.participantLeft, {
            participantId: data.participantId,
          });
      }
    }
    client.leave(this.group(code));
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
  private error(client: Socket, error: unknown) {
    const code =
      error instanceof Error && 'code' in error
        ? (error as { code: string }).code
        : 'REQUEST_FAILED';
    client.emit(RoomEvents.error, { code });
  }
}
