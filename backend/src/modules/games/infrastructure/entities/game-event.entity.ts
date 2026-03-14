import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { GameEventPayload, GameEventType } from '../../domain/events';

@Entity('game_events')
@Index(['gameId', 'createdAt'])
export class GameEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'game_id', type: 'uuid' })
  gameId!: string;

  @Column({ name: 'turn_number', type: 'int' })
  turnNumber!: number;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: GameEventType;

  @Column({ type: 'jsonb' })
  payload!: GameEventPayload;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
