import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlansService } from './plans.service';
import { CancelPlanDto, CreatePlanDto, UpdatePlanDto } from './dto/plans.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post('groups/:groupId/plans')
  create(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.createPlan({
      groupId,
      userId: req.user.userId,
      title: dto.title,
      type: dto.type,
      scheduledAt: new Date(dto.scheduledAt),
      place: dto.place,
      locationRadiusM: dto.locationRadiusM,
      requiresAllConfirm: dto.requiresAllConfirm,
      participants: dto.participants,
    });
  }

  @Get('groups/:groupId/plans')
  list(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.plans.listGroupPlans({
      groupId,
      userId: req.user.userId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('plans/:planId')
  get(@Request() req: any, @Param('planId') planId: string) {
    return this.plans.getPlan(planId, req.user.userId);
  }

  @Patch('plans/:planId')
  update(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.updatePlan(planId, req.user.userId, {
      ...dto,
      ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
    });
  }

  @Post('plans/:planId/cancel')
  cancel(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() dto: CancelPlanDto,
  ) {
    return this.plans.cancelPlan(planId, req.user.userId, dto.reason);
  }
}
