import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GamesModule } from './modules/games/games.module';
import { UserEntity } from './modules/users/entities/user.entity';
import { GameEntity } from './modules/games/infrastructure/entities/game.entity';
import { GameEventEntity } from './modules/games/infrastructure/entities/game-event.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env['DATABASE_URL'] ?? 'postgresql://neon:neon@localhost:5432/neon_grid',
      entities: [UserEntity, GameEntity, GameEventEntity],
      // synchronize creates/updates tables automatically — suitable for development
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    UsersModule,
    GamesModule,
  ],
})
export class AppModule {}
