import { gameReducer, EMPTY_GAME_STATE, projectGameState } from './game.reducer';
import { GameState, BoardUnit, CardInstance } from './types';
import {
  GameCreatedPayload,
  PlayerJoinedPayload,
  GameStartedPayload,
  CardPlayedPayload,
  UnitAttackedPayload,
  TurnEndedPayload,
} from './events';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const P1 = 'player-1';
const P2 = 'player-2';
const GAME_ID = 'game-abc';

function makeInstance(instanceId: string, cardId: CardInstance['cardId']): CardInstance {
  return { instanceId, cardId };
}

function makeUnit(
  instanceId: string,
  cardId: BoardUnit['cardId'],
  overrides: Partial<BoardUnit> = {}
): BoardUnit {
  const defaults: BoardUnit = {
    instanceId,
    cardId,
    currentHealth: 1,
    currentAttack: 1,
    hasAttacked: false,
    overclocked: false,
  };
  return { ...defaults, ...overrides };
}

/** Build a minimal active game state with two players and empty boards */
function buildActiveState(): GameState {
  let state = EMPTY_GAME_STATE;

  state = gameReducer(state, {
    eventType: 'GAME_CREATED',
    payload: { gameId: GAME_ID, player1Id: P1 } satisfies GameCreatedPayload,
  });
  state = gameReducer(state, {
    eventType: 'PLAYER_JOINED',
    payload: { player2Id: P2 } satisfies PlayerJoinedPayload,
  });

  const p1Deck: CardInstance[] = [
    makeInstance('p1-c1', 'street-samurai'),
    makeInstance('p1-c2', 'sniper'),
    makeInstance('p1-c3', 'corporate-guard'),
    makeInstance('p1-c4', 'kamikaze-drone'),
    makeInstance('p1-c5', 'emp-blast'),
    makeInstance('p1-c6', 'overclock'),
    makeInstance('p1-c7', 'street-samurai'),
    makeInstance('p1-c8', 'corporate-guard'),
    makeInstance('p1-c9', 'sniper'),
    makeInstance('p1-c10', 'kamikaze-drone'),
  ];
  const p2Deck: CardInstance[] = [
    makeInstance('p2-c1', 'street-samurai'),
    makeInstance('p2-c2', 'corporate-guard'),
    makeInstance('p2-c3', 'sniper'),
    makeInstance('p2-c4', 'kamikaze-drone'),
    makeInstance('p2-c5', 'emp-blast'),
    makeInstance('p2-c6', 'overclock'),
    makeInstance('p2-c7', 'street-samurai'),
    makeInstance('p2-c8', 'corporate-guard'),
    makeInstance('p2-c9', 'sniper'),
    makeInstance('p2-c10', 'kamikaze-drone'),
  ];

  state = gameReducer(state, {
    eventType: 'GAME_STARTED',
    payload: {
      player1Deck: p1Deck,
      player2Deck: p2Deck,
      firstPlayerId: P1,
    } satisfies GameStartedPayload,
  });

  return state;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Game Reducer', () => {
  describe('GAME_STARTED', () => {
    it('initialises both players with 20 HP', () => {
      const state = buildActiveState();
      expect(state.players[P1].hp).toBe(20);
      expect(state.players[P2].hp).toBe(20);
    });

    it('deals 3 cards to each hand and leaves 7 in deck', () => {
      const state = buildActiveState();
      expect(state.players[P1].hand).toHaveLength(3);
      expect(state.players[P1].deck).toHaveLength(7);
      expect(state.players[P2].hand).toHaveLength(3);
    });

    it('gives 2 AP to the first player, 0 to second', () => {
      const state = buildActiveState();
      expect(state.players[P1].actionPoints).toBe(2);
      expect(state.players[P2].actionPoints).toBe(0);
    });
  });

  // ─── Sniper on-play trigger ──────────────────────────────────────────────

  describe('Sniper on-play trigger', () => {
    it('deals 1 damage to the targeted enemy unit', () => {
      let state = buildActiveState();

      // Put a Corporate Guard (3 HP) on P2's board directly
      const guard = makeUnit('guard-1', 'corporate-guard', { currentHealth: 3, currentAttack: 1 });
      state = {
        ...state,
        players: {
          ...state.players,
          [P2]: { ...state.players[P2], board: [guard] },
        },
      };

      // Add a Sniper card to P1's hand
      const sniperCard = makeInstance('sniper-1', 'sniper');
      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], hand: [sniperCard], actionPoints: 3 },
        },
      };

      state = gameReducer(state, {
        eventType: 'CARD_PLAYED',
        payload: {
          playerId: P1,
          cardInstanceId: 'sniper-1',
          cardId: 'sniper',
          targetInstanceId: 'guard-1',
        } satisfies CardPlayedPayload,
      });

      // Corporate Guard should take 1 damage: 3 - 1 = 2
      const updatedGuard = state.players[P2].board.find((u) => u.instanceId === 'guard-1');
      expect(updatedGuard?.currentHealth).toBe(2);
    });

    it('kills a 1-HP enemy unit and removes it from the board', () => {
      let state = buildActiveState();

      const weakUnit = makeUnit('weak-1', 'street-samurai', { currentHealth: 1 });
      state = {
        ...state,
        players: { ...state.players, [P2]: { ...state.players[P2], board: [weakUnit] } },
      };

      const sniperCard = makeInstance('sniper-2', 'sniper');
      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], hand: [sniperCard], actionPoints: 3 },
        },
      };

      state = gameReducer(state, {
        eventType: 'CARD_PLAYED',
        payload: {
          playerId: P1,
          cardInstanceId: 'sniper-2',
          cardId: 'sniper',
          targetInstanceId: 'weak-1',
        } satisfies CardPlayedPayload,
      });

      expect(state.players[P2].board).toHaveLength(0);
    });
  });

  // ─── Kamikaze Drone death trigger ────────────────────────────────────────

  describe('Kamikaze Drone on-death trigger', () => {
    it('deals 2 damage to the enemy player when killed by an attack', () => {
      let state = buildActiveState();

      const drone = makeUnit('drone-1', 'kamikaze-drone', { currentHealth: 1, currentAttack: 3 });
      const attacker = makeUnit('samurai-1', 'street-samurai', {
        currentHealth: 2,
        currentAttack: 2,
        hasAttacked: false,
      });

      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], board: [attacker] },
          [P2]: { ...state.players[P2], board: [drone] },
        },
      };

      state = gameReducer(state, {
        eventType: 'UNIT_ATTACKED',
        payload: {
          attackerPlayerId: P1,
          attackerInstanceId: 'samurai-1',
          targetType: 'unit',
          targetId: 'drone-1',
        } satisfies UnitAttackedPayload,
      });

      // Kamikaze Drone died → P1 (the enemy of P2 who owned the drone) takes 2 damage
      expect(state.players[P1].hp).toBe(18); // 20 - 2 drone trigger
      expect(state.players[P2].board).toHaveLength(0); // drone removed
    });

    it('deals 2 damage to enemy player when killed by EMP Blast', () => {
      let state = buildActiveState();

      const drone = makeUnit('drone-2', 'kamikaze-drone', { currentHealth: 1, currentAttack: 3 });
      const empCard = makeInstance('emp-1', 'emp-blast');

      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], hand: [empCard], actionPoints: 2 },
          [P2]: { ...state.players[P2], board: [drone] },
        },
      };

      state = gameReducer(state, {
        eventType: 'CARD_PLAYED',
        payload: {
          playerId: P1,
          cardInstanceId: 'emp-1',
          cardId: 'emp-blast',
          targetInstanceId: 'drone-2',
        } satisfies CardPlayedPayload,
      });

      // Drone (owned by P2) dies → P1 (enemy of P2) takes 2 damage
      expect(state.players[P1].hp).toBe(18);
      expect(state.players[P2].board).toHaveLength(0);
    });
  });

  // ─── Overclock expiration ────────────────────────────────────────────────

  describe('Overclock buff expiration', () => {
    it('adds +2 attack to the target unit', () => {
      let state = buildActiveState();

      const samurai = makeUnit('s1', 'street-samurai', { currentAttack: 2 });
      const overclockCard = makeInstance('oc-1', 'overclock');

      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], board: [samurai], hand: [overclockCard], actionPoints: 2 },
        },
      };

      state = gameReducer(state, {
        eventType: 'CARD_PLAYED',
        payload: {
          playerId: P1,
          cardInstanceId: 'oc-1',
          cardId: 'overclock',
          targetInstanceId: 's1',
        } satisfies CardPlayedPayload,
      });

      expect(state.players[P1].board[0].currentAttack).toBe(4); // 2 + 2
      expect(state.players[P1].board[0].overclocked).toBe(true);
    });

    it('removes the +2 attack buff when the turn ends', () => {
      let state = buildActiveState();

      const samurai = makeUnit('s2', 'street-samurai', { currentAttack: 2, overclocked: true });
      state = {
        ...state,
        players: {
          ...state.players,
          [P1]: { ...state.players[P1], board: [{ ...samurai, currentAttack: 4 }] },
        },
      };

      // Simulate P1 ending their turn
      state = gameReducer(state, {
        eventType: 'TURN_ENDED',
        payload: { endingPlayerId: P1, nextPlayerId: P2 } satisfies TurnEndedPayload,
      });

      // Overclock buff removed: 4 - 2 = 2
      expect(state.players[P1].board[0].currentAttack).toBe(2);
      expect(state.players[P1].board[0].overclocked).toBe(false);
    });
  });

  // ─── TURN_ENDED ──────────────────────────────────────────────────────────

  describe('TURN_ENDED', () => {
    it('switches the active player and gives next player 2 AP', () => {
      let state = buildActiveState();
      expect(state.activePlayerId).toBe(P1);

      state = gameReducer(state, {
        eventType: 'TURN_ENDED',
        payload: { endingPlayerId: P1, nextPlayerId: P2 } satisfies TurnEndedPayload,
      });

      expect(state.activePlayerId).toBe(P2);
      expect(state.players[P2].actionPoints).toBe(2);
    });

    it('draws 1 card for the next player', () => {
      let state = buildActiveState();
      const handBefore = state.players[P2].hand.length;

      state = gameReducer(state, {
        eventType: 'TURN_ENDED',
        payload: { endingPlayerId: P1, nextPlayerId: P2 } satisfies TurnEndedPayload,
      });

      expect(state.players[P2].hand.length).toBe(handBefore + 1);
    });

    it('increments the turn number', () => {
      let state = buildActiveState();
      expect(state.turnNumber).toBe(1);

      state = gameReducer(state, {
        eventType: 'TURN_ENDED',
        payload: { endingPlayerId: P1, nextPlayerId: P2 } satisfies TurnEndedPayload,
      });

      expect(state.turnNumber).toBe(2);
    });
  });

  // ─── Replay reconstruction ───────────────────────────────────────────────

  describe('Replay reconstruction', () => {
    it('reconstructs state deterministically by replaying events', () => {
      const events: Array<{
        eventType: Parameters<typeof gameReducer>[1]['eventType'];
        payload: unknown;
      }> = [
        {
          eventType: 'GAME_CREATED',
          payload: { gameId: 'replay-game', player1Id: P1 } satisfies GameCreatedPayload,
        },
        {
          eventType: 'PLAYER_JOINED',
          payload: { player2Id: P2 } satisfies PlayerJoinedPayload,
        },
        {
          eventType: 'GAME_STARTED',
          payload: {
            player1Deck: Array.from({ length: 10 }, (_, i) =>
              makeInstance(`p1-${i}`, 'street-samurai')
            ),
            player2Deck: Array.from({ length: 10 }, (_, i) =>
              makeInstance(`p2-${i}`, 'corporate-guard')
            ),
            firstPlayerId: P1,
          } satisfies GameStartedPayload,
        },
      ];

      // Replay twice — must produce identical output
      const stateA = events.reduce((s, e) => gameReducer(s, e), EMPTY_GAME_STATE);
      const stateB = events.reduce((s, e) => gameReducer(s, e), EMPTY_GAME_STATE);

      expect(stateA).toEqual(stateB);
      expect(stateA.players[P1].hp).toBe(20);
      expect(stateA.status).toBe('active');
    });
  });

  // ─── Projection ──────────────────────────────────────────────────────────

  describe('projectGameState', () => {
    it('hides opponent hand contents but reveals hand count', () => {
      const state = buildActiveState();
      const projected = projectGameState(state, P1);
      expect(projected.myState.hand.length).toBeGreaterThan(0);
      expect(projected.opponentState.handCount).toBe(state.players[P2].hand.length);
      expect((projected.opponentState as any).hand).toBeUndefined();
    });
  });
});
