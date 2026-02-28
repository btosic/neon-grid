// ─── Card definitions ────────────────────────────────────────────────────────

export type CardId =
  | 'street-samurai'
  | 'corporate-guard'
  | 'sniper'
  | 'kamikaze-drone'
  | 'emp-blast'
  | 'overclock';

export type CardType = 'unit' | 'event';

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  type: CardType;
  /** Only present for unit cards */
  attack?: number;
  /** Only present for unit cards */
  health?: number;
}

// ─── In-game card instances ───────────────────────────────────────────────────

/** A card that lives in a player's hand or deck */
export interface CardInstance {
  instanceId: string;
  cardId: CardId;
}

/** A unit that has been played onto the board */
export interface BoardUnit {
  instanceId: string;
  cardId: CardId;
  currentHealth: number;
  /** Base attack + any temporary buffs (e.g. Overclock) */
  currentAttack: number;
  /** True once this unit has attacked this turn */
  hasAttacked: boolean;
  /** True if this unit received Overclock buff this turn */
  overclocked: boolean;
}

// ─── Player & game state ──────────────────────────────────────────────────────

export interface PlayerState {
  id: string;
  hp: number;
  hand: CardInstance[];
  board: BoardUnit[];
  /** Cards remaining in deck */
  deck: CardInstance[];
  actionPoints: number;
}

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GameState {
  gameId: string;
  status: GameStatus;
  /** Keyed by player id */
  players: Record<string, PlayerState>;
  /** [player1Id, player2Id] — order determined at game start */
  playerOrder: [string, string];
  activePlayerId: string;
  turnNumber: number;
  winner?: string;
}

// ─── Projected state (sent over WebSocket) ───────────────────────────────────

/** Opponent view — actual hand cards are hidden, only count is exposed */
export interface OpponentView {
  id: string;
  hp: number;
  handCount: number;
  board: BoardUnit[];
  actionPoints: number;
}

export interface ProjectedGameState {
  gameId: string;
  status: GameStatus;
  myState: PlayerState;
  opponentState: OpponentView;
  activePlayerId: string;
  turnNumber: number;
  winner?: string;
}
