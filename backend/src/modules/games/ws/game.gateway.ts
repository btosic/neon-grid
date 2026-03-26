import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'ws';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { GameService } from '../application/game.service';
import { JwtPayload } from '../../auth/jwt.strategy';
import { GameCommand } from '../domain/commands';

// ─── DTO shapes received from the client ─────────────────────────────────────

interface JoinGameData {
  gameId: string;
}

interface PlayCardData {
  gameId: string;
  cardInstanceId: string;
  targetInstanceId?: string;
}

interface AttackData {
  gameId: string;
  attackerInstanceId: string;
  targetId: string;
  targetType: 'unit' | 'player';
}

interface EndTurnData {
  gameId: string;
}

// ─── Augmented socket ─────────────────────────────────────────────────────────

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  email?: string;
  gameId?: string;
}

@WebSocketGateway({
  // Port is inherited from the HTTP server when 0 is used;
  // The NestJS WsAdapter attaches to the same HTTP server.
  path: '/',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /** gameId → set of authenticated sockets in that room */
  private rooms = new Map<string, Set<AuthenticatedSocket>>();

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService
  ) {}

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  handleConnection(client: AuthenticatedSocket, req: IncomingMessage): void {
    try {
      const url = new URL(req.url ?? '/', `ws://localhost`);
      const token = url.searchParams.get('token');
      if (!token) throw new Error('Missing token');

      const payload = this.jwtService.verify<JwtPayload>(token);
      client.userId = payload.sub;
      client.email = payload.email;
    } catch {
      // Reject unauthenticated connection
      client.send(JSON.stringify({ event: 'error', data: { message: 'Unauthorized' } }));
      client.close();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.gameId) {
      const room = this.rooms.get(client.gameId);
      room?.delete(client);
    }
  }

  // ─── Message handlers ─────────────────────────────────────────────────────

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinGameData
  ): Promise<void> {
    if (!client.userId) {
      this.sendError(client, 'Unauthorized');
      return;
    }

    client.gameId = data.gameId;

    if (!this.rooms.has(data.gameId)) {
      this.rooms.set(data.gameId, new Set());
    }
    this.rooms.get(data.gameId)!.add(client);

    // Rebuild state and decide what to send back
    const state = await this.gameService.rebuildState(data.gameId);
    if (!state) {
      this.sendError(client, 'Game not found');
      return;
    }

    const [p1, p2] = state.playerOrder;
    if (client.userId !== p1 && client.userId !== p2) {
      this.sendError(client, 'You are not a participant in this game');
      return;
    }

    if (state.status === 'waiting') {
      // Game hasn't started yet — tell the creator to wait
      client.send(JSON.stringify({ event: 'waiting_for_opponent', data: { gameId: data.gameId } }));
    } else {
      // Game is active — broadcast projected state to every connected player in the room
      // (covers both the reconnecting player and anyone already waiting in the room)
      this.broadcastState(data.gameId, state);
    }
  }

  @SubscribeMessage('play_card')
  async handlePlayCard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: PlayCardData
  ): Promise<void> {
    if (!client.userId) return;

    const command: GameCommand = {
      type: 'PLAY_CARD',
      gameId: data.gameId,
      playerId: client.userId,
      cardInstanceId: data.cardInstanceId,
      targetInstanceId: data.targetInstanceId,
    };

    await this.executeCommand(client, command);
  }

  @SubscribeMessage('attack')
  async handleAttack(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: AttackData
  ): Promise<void> {
    if (!client.userId) return;

    const command: GameCommand = {
      type: 'ATTACK_WITH_UNIT',
      gameId: data.gameId,
      playerId: client.userId,
      attackerInstanceId: data.attackerInstanceId,
      targetType: data.targetType,
      targetId: data.targetId,
    };

    await this.executeCommand(client, command);
  }

  @SubscribeMessage('end_turn')
  async handleEndTurn(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: EndTurnData
  ): Promise<void> {
    if (!client.userId) return;

    const command: GameCommand = {
      type: 'END_TURN',
      gameId: data.gameId,
      playerId: client.userId,
    };

    await this.executeCommand(client, command);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async executeCommand(client: AuthenticatedSocket, command: GameCommand): Promise<void> {
    try {
      const newState = await this.gameService.handleCommand(command);
      this.broadcastState(command.gameId, newState);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.sendError(client, message);
    }
  }

  /** Broadcast projected state to every client in the game room */
  private broadcastState(
    gameId: string,
    state: Parameters<typeof this.gameService.projectState>[0]
  ): void {
    const room = this.rooms.get(gameId);
    if (!room) return;

    for (const socket of room) {
      if (socket.readyState === WebSocket.OPEN && socket.userId) {
        const [p1, p2] = state.playerOrder;
        if (socket.userId === p1 || socket.userId === p2) {
          const projected = this.gameService.projectState(state, socket.userId);
          socket.send(JSON.stringify({ event: 'game_state', data: projected }));
        }
      }
    }
  }

  private sendError(client: AuthenticatedSocket, message: string): void {
    client.send(JSON.stringify({ event: 'error', data: { message } }));
  }
}
