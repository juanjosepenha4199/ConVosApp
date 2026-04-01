import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { GroupType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArenaService } from './arena.service';

@UseGuards(JwtAuthGuard)
@Controller('arena')
export class ArenaController {
  constructor(private readonly arena: ArenaService) {}

  @Get('leaderboard')
  leaderboard(
    @Request() _req: any,
    @Query('type') type?: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
  ) {
    const t: GroupType =
      type === 'couple' ||
      type === 'friends' ||
      type === 'family' ||
      type === 'other'
        ? (type as GroupType)
        : 'friends';
    const days = range === '30d' ? 30 : 7;
    return this.arena.leaderboard({
      type: t,
      days,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('me')
  me(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('range') range?: string,
  ) {
    const t: GroupType =
      type === 'couple' ||
      type === 'friends' ||
      type === 'family' ||
      type === 'other'
        ? (type as GroupType)
        : 'friends';
    const days = range === '30d' ? 30 : 7;
    return this.arena.myPositions({ userId: req.user.userId, type: t, days });
  }
}
