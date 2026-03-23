import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { GameRepository } from '../infrastructure/game.repository';
import { GameEventRepository } from '../infrastructure/game-event.repository';
import { GameEntity } from '../infrastructure/entities/game.entity';
import { GameEventEntity } from '../infrastructure/entities/game-event.entity';
import { GameAggregate } from '../domain/game.aggregate';
import { GameState, ProjectedGameState } from '../domain/types';
import { buildDeck, shuffleDeck } from '../domain/cards';
import { GameCommand } from '../domain/commands';
import {
  GameCreatedPayload,
  PlayerJoinedPayload,
  GameStartedPayload,
  CardPlayedPayload,
  UnitAttackedPayload,
  TurnEndedPayload,
  GameEndedPayload,
  GameEventPayload,
  GameEventType,
} from '../domain/events';
import { gameReducer, projectGameState, EMPTY_GAME_STATE } from '../domain/game.reducer';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepo: GameRepository,
    private readonly gameEventRepo: GameEventRepository
  ) {}

  // ─── REST operations ────────────────────────────────────────────────────────

  async listGames(): Promise<GameEntity[]> {
    return this.gameRepo.findAll();
  }

  async createGame(playerId: string): Promise<GameEntity> {
    const game = await this.gameRepo.create(playerId);

    const payload: GameCreatedPayload = { gameId: game.id, player1Id: playerId };
    await this.gameEventRepo.append(game.id, 0, 'GAME_CREATED', payload);

    return game;
  }

  async joinGame(gameId: string, playerId: string): Promise<GameEntity> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'waiting')
      throw new BadRequestException('Game is not waiting for a player');
    if (game.player1Id === playerId) throw new ForbiddenException('You are already in this game');

    // Persist PLAYER_JOINED event
    const joinPayload: PlayerJoinedPayload = { player2Id: playerId };
    await this.gameEventRepo.append(gameId, 0, 'PLAYER_JOINED', joinPayload);

    // Shuffle both decks (only place randomness occurs) and persist GAME_STARTED
    const p1Deck = shuffleDeck(buildDeck());
    const p2Deck = shuffleDeck(buildDeck());
    const startPayload: GameStartedPayload = {
      player1Deck: p1Deck,
      player2Deck: p2Deck,
      firstPlayerId: Math.random() < 0.5 ? game.player1Id : playerId,
    };
    await this.gameEventRepo.append(gameId, 1, 'GAME_STARTED', startPayload);

    await this.gameRepo.update(gameId, { player2Id: playerId, status: 'active' });

    return (await this.gameRepo.findById(gameId))!;
  }

  async getReplay(gameId: string): Promise<GameEventEntity[]> {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');
    return this.gameEventRepo.findByGameId(gameId);
  }

  // ─── Command handling (WebSocket) ───────────────────────────────────────────

  /**
   * Validate and execute a game command.
   * Returns the new full game state so the gateway can project and broadcast it.
   */
  async handleCommand(command: GameCommand): Promise<GameState> {
    const events = await this.gameEventRepo.findByGameId(command.gameId);
    if (events.length === 0) throw new NotFoundException('Game not found');

    const aggregate = new GameAggregate(events);
    aggregate.validateCommand(command);

    const state = aggregate.getState();
    const turnNumber = state.turnNumber;

    // Build the event payload from the command
    let eventType: GameEventType;
    let payload: GameEventPayload;

    switch (command.type) {
      case 'PLAY_CARD': {
        const card = state.players[command.playerId].hand.find(
          (c) => c.instanceId === command.cardInstanceId
        )!;
        eventType = 'CARD_PLAYED';
        payload = {
          playerId: command.playerId,
          cardInstanceId: command.cardInstanceId,
          cardId: card.cardId,
          targetInstanceId: command.targetInstanceId,
        } satisfies CardPlayedPayload;
        break;
      }
      case 'ATTACK_WITH_UNIT': {
        eventType = 'UNIT_ATTACKED';
        payload = {
          attackerPlayerId: command.playerId,
          attackerInstanceId: command.attackerInstanceId,
          targetType: command.targetType,
          targetId: command.targetId,
        } satisfies UnitAttackedPayload;
        break;
      }
      case 'END_TURN': {
        const [p1, p2] = state.playerOrder;
        const nextPlayerId = command.playerId === p1 ? p2 : p1;
        eventType = 'TURN_ENDED';
        payload = {
          endingPlayerId: command.playerId,
          nextPlayerId,
        } satisfies TurnEndedPayload;
        break;
      }
    }

    await this.gameEventRepo.append(command.gameId, turnNumber, eventType, payload);
    aggregate.applyEvent({ eventType, payload });

    // Check win condition after every action
    const loser = aggregate.findLoser();
    if (loser) {
      const winnerId = aggregate.getOpponentId(loser);
      const endPayload: GameEndedPayload = { winnerId };
      await this.gameEventRepo.append(command.gameId, turnNumber, 'GAME_ENDED', endPayload);
      aggregate.applyEvent({ eventType: 'GAME_ENDED', payload: endPayload });
      await this.gameRepo.update(command.gameId, { status: 'finished', winnerId });
    }

    return aggregate.getState();
  }

  // ─── State rebuild ──────────────────────────────────────────────────────────

  /** Rebuild full game state from the event store (used when a player connects/reconnects) */
  async rebuildState(gameId: string): Promise<GameState | null> {
    const events = await this.gameEventRepo.findByGameId(gameId);
    if (events.length === 0) return null;
    return events.reduce(
      (s, e) => gameReducer(s, { eventType: e.eventType, payload: e.payload }),
      EMPTY_GAME_STATE
    );
  }

  projectState(state: GameState, forPlayerId: string): ProjectedGameState {
    return projectGameState(state, forPlayerId) as ProjectedGameState;
  }
}
