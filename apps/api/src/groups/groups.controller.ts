import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto, CreateInviteDto } from './dto/groups.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post('groups')
  createGroup(@Request() req: any, @Body() dto: CreateGroupDto) {
    return this.groups.createGroup({
      userId: req.user.userId,
      name: dto.name,
      type: dto.type,
    });
  }

  @Get('groups')
  listMyGroups(@Request() req: any) {
    return this.groups.listMyGroups(req.user.userId);
  }

  @Get('groups/:groupId')
  async getGroup(@Request() req: any, @Param('groupId') groupId: string) {
    await this.groups.requireMember(groupId, req.user.userId);
    return this.groups.getGroupOrThrow(groupId);
  }

  @Get('groups/:groupId/members')
  listMembers(@Request() req: any, @Param('groupId') groupId: string) {
    return this.groups.listMembers(groupId, req.user.userId);
  }

  @Get('groups/:groupId/validation-photos')
  validationPhotos(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ) {
    return this.groups.listValidationGallery(
      groupId,
      req.user.userId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('groups/:groupId/invites')
  createInvite(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.groups.createInviteLink({
      groupId,
      userId: req.user.userId,
      expiresInDays: dto.expiresInDays,
      maxUses: dto.maxUses,
    });
  }

  @Post('invites/:token/join')
  joinInvite(@Request() req: any, @Param('token') token: string) {
    return this.groups.joinByInviteToken({ token, userId: req.user.userId });
  }
}
