import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../../users/entities/user.entity';

@Entity('games')
export class GameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', default: 'waiting' })
  status!: 'waiting' | 'active' | 'finished';

  @Column({ name: 'player1_id', type: 'uuid' })
  player1Id!: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'player1_id' })
  player1!: UserEntity;

  @Column({ name: 'player2_id', type: 'uuid', nullable: true })
  player2Id!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'player2_id' })
  player2!: UserEntity | null;

  @Column({ name: 'winner_id', type: 'uuid', nullable: true })
  winnerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
