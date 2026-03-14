import { GameState, PlayerState, BoardUnit, CardInstance } from './types';
import { CARD_DEFINITIONS } from './cards';
import {
  GameEventType,
  GameCreatedPayload,
  PlayerJoinedPayload,
  GameStartedPayload,
  CardPlayedPayload,
  UnitAttackedPayload,
  TurnEndedPayload,
  GameEndedPayload,
} from './events';

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_HP = 20;
const INITIAL_HAND_SIZE = 3;
const AP_PER_TURN = 2;

// ─── Initial state ────────────────────────────────────────────────────────────

export const EMPTY_GAME_STATE: GameState = {
  gameId: '',
  status: 'waiting',
  players: {},
  playerOrder: ['', ''],
  activePlayerId: '',
  turnNumber: 0,
};

// ─── Death-trigger helper ─────────────────────────────────────────────────────

/**
 * Apply damage to a board unit.
 * If it dies and is a Kamikaze Drone, accumulate the 2-damage trigger against
 * the unit's *enemy* player in `hpDeltas`.
 *
 * Returns the updated unit, or `null` if the unit died.
 */
function applyDamageToUnit(
  unit: BoardUnit,
  damage: number,
  ownerPlayerId: string,
  opponentPlayerId: string,
  hpDeltas: Record<string, number>
): BoardUnit | null {
  const newHealth = unit.currentHealth - damage;
  if (newHealth <= 0) {
    if (unit.cardId === 'kamikaze-drone') {
      // On Death: deal 2 damage to the enemy of whoever owns this drone
      hpDeltas[opponentPlayerId] = (hpDeltas[opponentPlayerId] ?? 0) - 2;
    }
    return null;
  }
  return { ...unit, currentHealth: newHealth };
}

/**
 * Remove dead units from a board, collecting any death-trigger hp changes.
 * Returns [survivingBoard, hpDeltas].
 */
function processDeaths(
  board: BoardUnit[],
  ownerPlayerId: string,
  opponentPlayerId: string
): [BoardUnit[], Record<string, number>] {
  const hpDeltas: Record<string, number> = {};
  const survivors = board.filter((unit) => {
    if (unit.currentHealth <= 0) {
      if (unit.cardId === 'kamikaze-drone') {
        hpDeltas[opponentPlayerId] = (hpDeltas[opponentPlayerId] ?? 0) - 2;
      }
      return false;
    }
    return true;
  });
  return [survivors, hpDeltas];
}

// ─── Pure reducer ─────────────────────────────────────────────────────────────

/**
 * The reducer is the single source of truth for game state transitions.
 * It MUST remain pure: no side effects, no randomness.
 */
export function gameReducer(
  state: GameState,
  event: { eventType: GameEventType; payload: unknown }
): GameState {
  switch (event.eventType) {
    // ── GAME_CREATED ──────────────────────────────────────────────────────────
    case 'GAME_CREATED': {
      const p = event.payload as GameCreatedPayload;
      const player1State: PlayerState = {
        id: p.player1Id,
        hp: INITIAL_HP,
        hand: [],
        board: [],
        deck: [],
        actionPoints: 0,
      };
      return {
        ...EMPTY_GAME_STATE,
        gameId: p.gameId,
        status: 'waiting',
        players: { [p.player1Id]: player1State },
        playerOrder: [p.player1Id, ''],
      };
    }

    // ── PLAYER_JOINED ─────────────────────────────────────────────────────────
    case 'PLAYER_JOINED': {
      const p = event.payload as PlayerJoinedPayload;
      const [p1] = state.playerOrder;
      const player2State: PlayerState = {
        id: p.player2Id,
        hp: INITIAL_HP,
        hand: [],
        board: [],
        deck: [],
        actionPoints: 0,
      };
      return {
        ...state,
        players: { ...state.players, [p.player2Id]: player2State },
        playerOrder: [p1, p.player2Id],
      };
    }

    // ── GAME_STARTED ──────────────────────────────────────────────────────────
    case 'GAME_STARTED': {
      const p = event.payload as GameStartedPayload;
      const [p1Id, p2Id] = state.playerOrder;

      // Split pre-shuffled deck into initial hand + remaining deck
      const p1Hand: CardInstance[] = p.player1Deck.slice(0, INITIAL_HAND_SIZE);
      const p1Deck: CardInstance[] = p.player1Deck.slice(INITIAL_HAND_SIZE);
      const p2Hand: CardInstance[] = p.player2Deck.slice(0, INITIAL_HAND_SIZE);
      const p2Deck: CardInstance[] = p.player2Deck.slice(INITIAL_HAND_SIZE);

      return {
        ...state,
        status: 'active',
        players: {
          [p1Id]: { ...state.players[p1Id], hand: p1Hand, deck: p1Deck, actionPoints: AP_PER_TURN },
          [p2Id]: { ...state.players[p2Id], hand: p2Hand, deck: p2Deck, actionPoints: 0 },
        },
        activePlayerId: p.firstPlayerId,
        turnNumber: 1,
      };
    }

    // ── CARD_PLAYED ───────────────────────────────────────────────────────────
    case 'CARD_PLAYED': {
      const p = event.payload as CardPlayedPayload;
      const cardDef = CARD_DEFINITIONS[p.cardId];
      const [p1Id, p2Id] = state.playerOrder;
      const opponentId = p.playerId === p1Id ? p2Id : p1Id;

      const player = { ...state.players[p.playerId] };
      const opponent = { ...state.players[opponentId] };

      // Remove card from hand and deduct AP
      player.hand = player.hand.filter((c) => c.instanceId !== p.cardInstanceId);
      player.actionPoints -= cardDef.cost;

      let playerBoard = [...player.board];
      let opponentBoard = [...opponent.board];
      let opponentHp = opponent.hp;
      let playerHp = player.hp;

      if (cardDef.type === 'unit') {
        // Place unit on board
        const newUnit: BoardUnit = {
          instanceId: p.cardInstanceId,
          cardId: p.cardId,
          currentHealth: cardDef.health ?? 0,
          currentAttack: cardDef.attack ?? 0,
          hasAttacked: false,
          overclocked: false,
        };
        playerBoard = [...playerBoard, newUnit];

        // Sniper on-play: deal 1 damage to target enemy unit
        if (p.cardId === 'sniper' && p.targetInstanceId) {
          const hpDeltas: Record<string, number> = {};
          opponentBoard = opponentBoard.map((u) => {
            if (u.instanceId !== p.targetInstanceId) return u;
            return (
              applyDamageToUnit(u, 1, opponentId, p.playerId, hpDeltas) ?? {
                ...u,
                currentHealth: 0,
              }
            );
          });
          // Remove dead units and apply Kamikaze Drone triggers
          const [survived, deathDeltas] = processDeaths(opponentBoard, opponentId, p.playerId);
          opponentBoard = survived;
          opponentHp += deathDeltas[opponentId] ?? 0;
          playerHp += deathDeltas[p.playerId] ?? 0;
          opponentHp += hpDeltas[opponentId] ?? 0;
          playerHp += hpDeltas[p.playerId] ?? 0;
        }
      } else {
        // Event card effects
        if (p.cardId === 'emp-blast' && p.targetInstanceId) {
          // Deal 2 damage to any unit
          const hpDeltas: Record<string, number> = {};

          const pIdx = playerBoard.findIndex((u) => u.instanceId === p.targetInstanceId);
          if (pIdx >= 0) {
            const updated = applyDamageToUnit(
              playerBoard[pIdx],
              2,
              p.playerId,
              opponentId,
              hpDeltas
            );
            playerBoard = updated
              ? playerBoard.map((u, i) => (i === pIdx ? updated : u))
              : playerBoard.filter((_, i) => i !== pIdx);
          } else {
            const oIdx = opponentBoard.findIndex((u) => u.instanceId === p.targetInstanceId);
            if (oIdx >= 0) {
              const updated = applyDamageToUnit(
                opponentBoard[oIdx],
                2,
                opponentId,
                p.playerId,
                hpDeltas
              );
              opponentBoard = updated
                ? opponentBoard.map((u, i) => (i === oIdx ? updated : u))
                : opponentBoard.filter((_, i) => i !== oIdx);
            }
          }

          // After removing dead units, run processDeaths for any that reached 0
          const [pSurvived, pDeaths] = processDeaths(playerBoard, p.playerId, opponentId);
          const [oSurvived, oDeaths] = processDeaths(opponentBoard, opponentId, p.playerId);
          playerBoard = pSurvived;
          opponentBoard = oSurvived;

          // Merge all hp deltas
          const allDeltas = [hpDeltas, pDeaths, oDeaths];
          for (const d of allDeltas) {
            playerHp += d[p.playerId] ?? 0;
            opponentHp += d[opponentId] ?? 0;
          }
        } else if (p.cardId === 'overclock' && p.targetInstanceId) {
          // Give +2 attack to target unit (any unit, buff expires at end of turn)
          const pIdx = playerBoard.findIndex((u) => u.instanceId === p.targetInstanceId);
          if (pIdx >= 0) {
            playerBoard = playerBoard.map((u, i) =>
              i === pIdx ? { ...u, currentAttack: u.currentAttack + 2, overclocked: true } : u
            );
          } else {
            const oIdx = opponentBoard.findIndex((u) => u.instanceId === p.targetInstanceId);
            if (oIdx >= 0) {
              opponentBoard = opponentBoard.map((u, i) =>
                i === oIdx ? { ...u, currentAttack: u.currentAttack + 2, overclocked: true } : u
              );
            }
          }
        }
      }

      return {
        ...state,
        players: {
          ...state.players,
          [p.playerId]: { ...player, board: playerBoard, hp: playerHp },
          [opponentId]: { ...opponent, board: opponentBoard, hp: opponentHp },
        },
      };
    }

    // ── UNIT_ATTACKED ─────────────────────────────────────────────────────────
    case 'UNIT_ATTACKED': {
      const p = event.payload as UnitAttackedPayload;
      const [p1Id, p2Id] = state.playerOrder;
      const opponentId = p.attackerPlayerId === p1Id ? p2Id : p1Id;

      const attacker = state.players[p.attackerPlayerId];
      const opponent = state.players[opponentId];

      const attackerUnit = attacker.board.find((u) => u.instanceId === p.attackerInstanceId);
      if (!attackerUnit) return state;

      let attackerBoard = [...attacker.board];
      let opponentBoard = [...opponent.board];
      let attackerHp = attacker.hp;
      let opponentHp = opponent.hp;
      const hpDeltas: Record<string, number> = {};

      if (p.targetType === 'player') {
        // Direct player attack
        opponentHp -= attackerUnit.currentAttack;
      } else {
        // Unit vs unit — simultaneous damage exchange
        const targetUnit = opponentBoard.find((u) => u.instanceId === p.targetId);
        if (!targetUnit) return state;

        // Apply attacker's damage to defender
        const updatedTarget = applyDamageToUnit(
          targetUnit,
          attackerUnit.currentAttack,
          opponentId,
          p.attackerPlayerId,
          hpDeltas
        );
        opponentBoard = updatedTarget
          ? opponentBoard.map((u) => (u.instanceId === p.targetId ? updatedTarget : u))
          : opponentBoard.filter((u) => u.instanceId !== p.targetId);

        // Apply defender's damage to attacker
        const updatedAttacker = applyDamageToUnit(
          attackerUnit,
          targetUnit.currentAttack,
          p.attackerPlayerId,
          opponentId,
          hpDeltas
        );
        attackerBoard = updatedAttacker
          ? attackerBoard.map((u) => (u.instanceId === p.attackerInstanceId ? updatedAttacker : u))
          : attackerBoard.filter((u) => u.instanceId !== p.attackerInstanceId);
      }

      // Mark the unit as having attacked (it may have survived)
      attackerBoard = attackerBoard.map((u) =>
        u.instanceId === p.attackerInstanceId ? { ...u, hasAttacked: true } : u
      );

      // Clean up any additional units at zero health (shouldn't happen but safety net)
      const [aSurvived, aDeaths] = processDeaths(attackerBoard, p.attackerPlayerId, opponentId);
      const [oSurvived, oDeaths] = processDeaths(opponentBoard, opponentId, p.attackerPlayerId);

      attackerBoard = aSurvived;
      opponentBoard = oSurvived;

      const allDeltas = [hpDeltas, aDeaths, oDeaths];
      for (const d of allDeltas) {
        attackerHp += d[p.attackerPlayerId] ?? 0;
        opponentHp += d[opponentId] ?? 0;
      }

      return {
        ...state,
        players: {
          ...state.players,
          [p.attackerPlayerId]: { ...attacker, board: attackerBoard, hp: attackerHp },
          [opponentId]: { ...opponent, board: opponentBoard, hp: opponentHp },
        },
      };
    }

    // ── TURN_ENDED ────────────────────────────────────────────────────────────
    case 'TURN_ENDED': {
      const p = event.payload as TurnEndedPayload;
      const endingPlayer = state.players[p.endingPlayerId];
      const nextPlayer = state.players[p.nextPlayerId];

      // Strip Overclock buffs from ALL units on the ending player's board
      const cleanedBoard: BoardUnit[] = endingPlayer.board.map((u) =>
        u.overclocked ? { ...u, currentAttack: u.currentAttack - 2, overclocked: false } : u
      );

      // Reset hasAttacked for next player's units
      const refreshedNextBoard: BoardUnit[] = nextPlayer.board.map((u) => ({
        ...u,
        hasAttacked: false,
      }));

      // Draw 1 card for the next player (if deck is not empty)
      let nextHand = nextPlayer.hand;
      let nextDeck = nextPlayer.deck;
      if (nextDeck.length > 0) {
        nextHand = [...nextHand, nextDeck[0]];
        nextDeck = nextDeck.slice(1);
      }

      return {
        ...state,
        players: {
          ...state.players,
          [p.endingPlayerId]: { ...endingPlayer, board: cleanedBoard },
          [p.nextPlayerId]: {
            ...nextPlayer,
            hand: nextHand,
            deck: nextDeck,
            board: refreshedNextBoard,
            actionPoints: AP_PER_TURN,
          },
        },
        activePlayerId: p.nextPlayerId,
        turnNumber: state.turnNumber + 1,
      };
    }

    // ── GAME_ENDED ────────────────────────────────────────────────────────────
    case 'GAME_ENDED': {
      const p = event.payload as GameEndedPayload;
      return { ...state, status: 'finished', winner: p.winnerId };
    }

    default:
      return state;
  }
}

// ─── Projection helper ────────────────────────────────────────────────────────

/** Build a per-player view that hides the opponent's hand contents */
export function projectGameState(state: GameState, forPlayerId: string) {
  const [p1, p2] = state.playerOrder;
  const opponentId = forPlayerId === p1 ? p2 : p1;

  const myState = state.players[forPlayerId];
  const opp = state.players[opponentId];

  return {
    gameId: state.gameId,
    status: state.status,
    myState,
    opponentState: {
      id: opp.id,
      hp: opp.hp,
      handCount: opp.hand.length,
      board: opp.board,
      actionPoints: opp.actionPoints,
    },
    activePlayerId: state.activePlayerId,
    turnNumber: state.turnNumber,
    winner: state.winner,
  };
}
