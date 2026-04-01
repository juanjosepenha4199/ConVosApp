import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GamificationService } from './gamification.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('groups/:groupId/leaderboard')
  leaderboard(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('range') range?: string,
  ) {
    const days = range === '30d' ? 30 : 7;
    return this.gamification.leaderboard(groupId, req.user.userId, days);
  }
}
