import { CardId, CardInstance } from './types';

// ─── Event type discriminator ─────────────────────────────────────────────────

export type GameEventType =
  | 'GAME_CREATED'
  | 'PLAYER_JOINED'
  | 'GAME_STARTED'
  | 'CARD_PLAYED'
  | 'UNIT_ATTACKED'
  | 'TURN_ENDED'
  | 'GAME_ENDED';

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface GameCreatedPayload {
  gameId: string;
  player1Id: string;
}

export interface PlayerJoinedPayload {
  player2Id: string;
}

/**
 * Shuffled decks are stored in the event so the reducer stays deterministic.
 * Randomness is resolved by the service layer before creating this event.
 */
export interface GameStartedPayload {
  player1Deck: CardInstance[];
  player2Deck: CardInstance[];
  firstPlayerId: string;
}

export interface CardPlayedPayload {
  playerId: string;
  cardInstanceId: string;
  cardId: CardId;
  /** Required when playing Sniper, EMP Blast, or Overclock */
  targetInstanceId?: string;
}

export interface UnitAttackedPayload {
  attackerPlayerId: string;
  attackerInstanceId: string;
  targetType: 'unit' | 'player';
  /** Unit instanceId when targetType === 'unit', playerId when targetType === 'player' */
  targetId: string;
}

export interface TurnEndedPayload {
  endingPlayerId: string;
  nextPlayerId: string;
}

export interface GameEndedPayload {
  winnerId: string;
}

export type GameEventPayload =
  | GameCreatedPayload
  | PlayerJoinedPayload
  | GameStartedPayload
  | CardPlayedPayload
  | UnitAttackedPayload
  | TurnEndedPayload
  | GameEndedPayload;

// ─── Event envelope ───────────────────────────────────────────────────────────

export interface GameEvent {
  id: string;
  gameId: string;
  turnNumber: number;
  eventType: GameEventType;
  payload: GameEventPayload;
  createdAt: Date;
}
