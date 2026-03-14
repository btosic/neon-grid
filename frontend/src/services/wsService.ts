import { ProjectedGameState } from '../types/game';

type MessageHandler = (state: ProjectedGameState) => void;
type ErrorHandler = (message: string) => void;

const WS_URL = import.meta.env['VITE_WS_URL'] ?? 'ws://localhost:3001';

class WsService {
  private socket: WebSocket | null = null;
  private onStateUpdate: MessageHandler | null = null;
  private onError: ErrorHandler | null = null;
  private messageQueue: string[] = [];

  connect(token: string): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;

    this.socket = new WebSocket(`${WS_URL}?token=${token}`);

    this.socket.onopen = () => {
      for (const msg of this.messageQueue) {
        this.socket!.send(msg);
      }
      this.messageQueue = [];
    };

    this.socket.onmessage = (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as { event: string; data: unknown };
      if (msg.event === 'game_state') {
        this.onStateUpdate?.(msg.data as ProjectedGameState);
      } else if (msg.event === 'error') {
        const err = msg.data as { message: string };
        this.onError?.(err.message);
      }
    };

    this.socket.onerror = () => {
      this.onError?.('WebSocket connection error');
    };
  }

  disconnect(): void {
    this.messageQueue = [];
    this.socket?.close();
    this.socket = null;
  }

  onMessage(handler: MessageHandler): void {
    this.onStateUpdate = handler;
  }

  onErrorMessage(handler: ErrorHandler): void {
    this.onError = handler;
  }

  joinGame(gameId: string): void {
    this.send('join_game', { gameId });
  }

  playCard(gameId: string, cardInstanceId: string, targetInstanceId?: string): void {
    this.send('play_card', { gameId, cardInstanceId, targetInstanceId });
  }

  attack(
    gameId: string,
    attackerInstanceId: string,
    targetId: string,
    targetType: 'unit' | 'player'
  ): void {
    this.send('attack', { gameId, attackerInstanceId, targetId, targetType });
  }

  endTurn(gameId: string): void {
    this.send('end_turn', { gameId });
  }

  private send(event: string, data: unknown): void {
    const serialized = JSON.stringify({ event, data });
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(serialized);
    } else if (this.socket?.readyState === WebSocket.CONNECTING) {
      this.messageQueue.push(serialized);
    }
  }
}

// Singleton WebSocket service
export const wsService = new WsService();
