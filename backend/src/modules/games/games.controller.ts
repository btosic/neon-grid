import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { GameService } from './application/game.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';

interface RequestWithUser {
  user: AuthenticatedUser;
}

@Controller('games')
@UseGuards(JwtGuard)
export class GamesController {
  constructor(private readonly gameService: GameService) {}

  @Get()
  listGames() {
    return this.gameService.listGames();
  }

  @Post()
  createGame(@Request() req: RequestWithUser) {
    return this.gameService.createGame(req.user.userId);
  }

  @Post(':id/join')
  joinGame(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.gameService.joinGame(id, req.user.userId);
  }

  @Get(':id/replay')
  getReplay(@Param('id') id: string) {
    return this.gameService.getReplay(id);
  }
}
