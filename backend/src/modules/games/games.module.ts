import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEntity } from './infrastructure/entities/game.entity';
import { GameEventEntity } from './infrastructure/entities/game-event.entity';
import { GameRepository } from './infrastructure/game.repository';
import { EventStoreRepository } from './infrastructure/event-store.repository';
import { GameService } from './application/game.service';
import { GameGateway } from './ws/game.gateway';
import { GamesController } from './games.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameEntity, GameEventEntity]),
    // AuthModule exports JwtModule so GameGateway can inject JwtService
    AuthModule,
  ],
  providers: [GameRepository, EventStoreRepository, GameService, GameGateway],
  controllers: [GamesController],
})
export class GamesModule {}
