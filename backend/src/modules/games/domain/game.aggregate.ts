import { BadRequestException } from '@nestjs/common';
import { GameState } from './types';
import { CARD_DEFINITIONS } from './cards';
import { GameEvent, GameEventType } from './events';
import { GameCommand } from './commands';
import { gameReducer, EMPTY_GAME_STATE } from './game.reducer';

/**
 * The aggregate rebuilds state from an event stream and validates commands
 * against the current state before producing new events.
 *
 * Command processing follows: Command → Validate → Emit Event(s) → (persisted & reduced by service)
 */
export class GameAggregate {
  private state: GameState;

  constructor(events: Pick<GameEvent, 'eventType' | 'payload'>[]) {
    this.state = events.reduce((s, e) => gameReducer(s, e), EMPTY_GAME_STATE);
  }

  getState(): GameState {
    return this.state;
  }

  /**
   * Validate a command against the current state.
   * Throws BadRequestException on any violation.
   * Returns the validated payload fields needed to build the event.
   */
  validateCommand(command: GameCommand): void {
    const { status, activePlayerId, players, playerOrder } = this.state;

    if (status !== 'active') {
      throw new BadRequestException('Game is not active');
    }

    if (command.playerId !== activePlayerId) {
      throw new BadRequestException('Not your turn');
    }

    const player = players[command.playerId];
    const [p1Id, p2Id] = playerOrder;
    const opponentId = command.playerId === p1Id ? p2Id : p1Id;
    const opponent = players[opponentId];

    switch (command.type) {
      case 'PLAY_CARD': {
        const card = player.hand.find((c) => c.instanceId === command.cardInstanceId);
        if (!card) {
          throw new BadRequestException('Card not in hand');
        }
        const def = CARD_DEFINITIONS[card.cardId];
        if (player.actionPoints < def.cost) {
          throw new BadRequestException('Not enough action points');
        }

        // Validate target requirements for specific cards
        if (card.cardId === 'sniper') {
          if (!command.targetInstanceId) {
            throw new BadRequestException('Sniper requires a target enemy unit');
          }
          const targetExists = opponent.board.some(
            (u) => u.instanceId === command.targetInstanceId
          );
          if (!targetExists) {
            throw new BadRequestException('Sniper target not found on opponent board');
          }
        }
        if (card.cardId === 'emp-blast') {
          if (!command.targetInstanceId) {
            throw new BadRequestException('EMP Blast requires a target unit');
          }
          const allUnits = [...player.board, ...opponent.board];
          if (!allUnits.some((u) => u.instanceId === command.targetInstanceId)) {
            throw new BadRequestException('EMP Blast target unit not found');
          }
        }
        if (card.cardId === 'overclock') {
          if (!command.targetInstanceId) {
            throw new BadRequestException('Overclock requires a target unit');
          }
          const allUnits = [...player.board, ...opponent.board];
          if (!allUnits.some((u) => u.instanceId === command.targetInstanceId)) {
            throw new BadRequestException('Overclock target unit not found');
          }
        }
        break;
      }

      case 'ATTACK_WITH_UNIT': {
        const attacker = player.board.find((u) => u.instanceId === command.attackerInstanceId);
        if (!attacker) {
          throw new BadRequestException('Attacker not on your board');
        }
        if (attacker.hasAttacked) {
          throw new BadRequestException('Unit has already attacked this turn');
        }

        if (command.targetType === 'unit') {
          const target = opponent.board.find((u) => u.instanceId === command.targetId);
          if (!target) {
            throw new BadRequestException('Target unit not found on opponent board');
          }
        } else {
          if (command.targetId !== opponentId) {
            throw new BadRequestException('Invalid player target');
          }
        }
        break;
      }

      case 'END_TURN':
        // No additional validation needed; turn ownership already checked above
        break;
    }
  }

  /** Reconstruct state by replaying a new event on top of the current state */
  applyEvent(event: Pick<GameEvent, 'eventType' | 'payload'>): void {
    this.state = gameReducer(this.state, event);
  }

  /** Check if the game should end after the last state update */
  findLoser(): string | null {
    const { players, status } = this.state;
    if (status !== 'active') return null;
    for (const player of Object.values(players)) {
      if (player.hp <= 0) return player.id;
    }
    return null;
  }

  /** Derive the opponent id for a given player */
  getOpponentId(playerId: string): string {
    const [p1, p2] = this.state.playerOrder;
    return playerId === p1 ? p2 : p1;
  }
}
