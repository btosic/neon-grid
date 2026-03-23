import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEventEntity } from './entities/game-event.entity';
import { GameEventType, GameEventPayload } from '../domain/events';

@Injectable()
export class GameEventRepository {
  constructor(
    @InjectRepository(GameEventEntity)
    private readonly repo: Repository<GameEventEntity>
  ) {}

  async append(
    gameId: string,
    turnNumber: number,
    eventType: GameEventType,
    payload: GameEventPayload
  ): Promise<GameEventEntity> {
    const event = this.repo.create({ gameId, turnNumber, eventType, payload });
    return this.repo.save(event);
  }

  /** Return all events for a game ordered by insertion time — used for replay & state rebuild */
  async findByGameId(gameId: string): Promise<GameEventEntity[]> {
    return this.repo.find({
      where: { gameId },
      order: { createdAt: 'ASC' },
    });
  }
}
