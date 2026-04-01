import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedService } from './feed.service';

@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('feed')
  list(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: string,
  ) {
    return this.feed.listFeed(
      groupId,
      req.user.userId,
      limit ? Number(limit) : 50,
    );
  }
}
