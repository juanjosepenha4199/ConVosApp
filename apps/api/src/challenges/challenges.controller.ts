import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChallengesService } from './challenges.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get('groups/:groupId/challenges/active')
  active(@Request() req: any, @Param('groupId') groupId: string) {
    return this.challenges.listGroupChallenges(groupId, req.user.userId);
  }
}
