import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlanSuggestionsService } from './plan-suggestions.service';
import {
  CreatePlanSuggestionDto,
  SchedulePlanSuggestionDto,
  UpdatePlanSuggestionDto,
} from './dto/plan-suggestions.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PlanSuggestionsController {
  constructor(private readonly suggestions: PlanSuggestionsService) {}

  @Get('groups/:groupId/plan-suggestions')
  list(@Request() req: any, @Param('groupId') groupId: string) {
    return this.suggestions.list(groupId, req.user.userId);
  }

  @Post('groups/:groupId/plan-suggestions')
  create(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreatePlanSuggestionDto,
  ) {
    return this.suggestions.create(groupId, req.user.userId, dto);
  }

  @Patch('groups/:groupId/plan-suggestions/:suggestionId')
  update(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: UpdatePlanSuggestionDto,
  ) {
    return this.suggestions.update(groupId, suggestionId, req.user.userId, dto);
  }

  @Delete('groups/:groupId/plan-suggestions/:suggestionId')
  remove(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Param('suggestionId') suggestionId: string,
  ) {
    return this.suggestions.remove(groupId, suggestionId, req.user.userId);
  }

  @Post('groups/:groupId/plan-suggestions/:suggestionId/schedule')
  schedule(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: SchedulePlanSuggestionDto,
  ) {
    return this.suggestions.schedule(groupId, suggestionId, req.user.userId, {
      scheduledAt: new Date(dto.scheduledAt),
      venueLabel: dto.venueLabel,
      requiresAllConfirm: dto.requiresAllConfirm,
      participants: dto.participants,
    });
  }
}
