import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEntity } from './entities/game.entity';

@Injectable()
export class GameRepository {
  constructor(
    @InjectRepository(GameEntity)
    private readonly repo: Repository<GameEntity>,
  ) {}

  async create(player1Id: string): Promise<GameEntity> {
    const game = this.repo.create({ player1Id, status: 'waiting', player2Id: null, winnerId: null });
    return this.repo.save(game);
  }

  async findById(id: string): Promise<GameEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(): Promise<GameEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findWaiting(): Promise<GameEntity[]> {
    return this.repo.find({ where: { status: 'waiting' }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, partial: Partial<GameEntity>): Promise<void> {
    await this.repo.update(id, partial);
  }
}
