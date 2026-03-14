// Mirror the backend domain types for the frontend

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
  attack?: number;
  health?: number;
  effect?: string;
}

export const CARD_DEFINITIONS: Record<CardId, CardDef> = {
  'street-samurai': {
    id: 'street-samurai',
    name: 'Street Samurai',
    cost: 1,
    type: 'unit',
    attack: 2,
    health: 1,
  },
  'corporate-guard': {
    id: 'corporate-guard',
    name: 'Corporate Guard',
    cost: 1,
    type: 'unit',
    attack: 1,
    health: 3,
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    cost: 2,
    type: 'unit',
    attack: 2,
    health: 1,
    effect: 'On Play: 1 dmg to target',
  },
  'kamikaze-drone': {
    id: 'kamikaze-drone',
    name: 'Kamikaze Drone',
    cost: 2,
    type: 'unit',
    attack: 3,
    health: 1,
    effect: 'On Death: 2 dmg to enemy',
  },
  'emp-blast': {
    id: 'emp-blast',
    name: 'EMP Blast',
    cost: 1,
    type: 'event',
    effect: 'Deal 2 dmg to target unit',
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    cost: 1,
    type: 'event',
    effect: '+2 ATK to target this turn',
  },
};

export interface CardInstance {
  instanceId: string;
  cardId: CardId;
}

export interface BoardUnit {
  instanceId: string;
  cardId: CardId;
  currentHealth: number;
  currentAttack: number;
  hasAttacked: boolean;
  overclocked: boolean;
}

export interface PlayerState {
  id: string;
  hp: number;
  hand: CardInstance[];
  board: BoardUnit[];
  deck: CardInstance[];
  actionPoints: number;
}

export interface OpponentView {
  id: string;
  hp: number;
  handCount: number;
  board: BoardUnit[];
  actionPoints: number;
}

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface ProjectedGameState {
  gameId: string;
  status: GameStatus;
  myState: PlayerState;
  opponentState: OpponentView;
  activePlayerId: string;
  turnNumber: number;
  winner?: string;
}

export interface GameListItem {
  id: string;
  status: GameStatus;
  player1Id: string;
  player2Id: string | null;
  winnerId: string | null;
  createdAt: string;
}
