import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>
  ) {}

  async create(email: string, passwordHash: string): Promise<UserEntity> {
    const user = this.repo.create({ email, passwordHash });
    return this.repo.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }
}
