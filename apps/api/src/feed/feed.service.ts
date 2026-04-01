import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
  ) {}

  async listFeed(groupId: string, userId: string, limit = 50) {
    await this.groups.requireMember(groupId, userId);
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return this.prisma.feedItem.findMany({
      where: { groupId },
      orderBy: { occurredAt: 'desc' },
      take,
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        plan: { select: { id: true, title: true } },
      },
    });
  }
}
