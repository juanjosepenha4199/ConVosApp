import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PlanSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly plans: PlansService,
  ) {}

  async list(groupId: string, userId: string) {
    await this.groups.requireMember(groupId, userId);
    return this.prisma.planSuggestion.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async create(
    groupId: string,
    userId: string,
    input: { title: string; type: string; note?: string | null },
  ) {
    await this.groups.requireMember(groupId, userId);
    return this.prisma.planSuggestion.create({
      data: {
        groupId,
        createdBy: userId,
        title: input.title.trim(),
        type: input.type as any,
        note: input.note?.trim() ? input.note.trim() : null,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  private async assertCanModifySuggestion(
    groupId: string,
    suggestionId: string,
    userId: string,
  ) {
    const s = await this.prisma.planSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!s || s.groupId !== groupId) throw new NotFoundException('SUGGESTION_NOT_FOUND');
    const member = await this.groups.requireMember(s.groupId, userId);
    const isCreator = s.createdBy === userId;
    const isAdmin = member.role === GroupRole.admin;
    if (!isCreator && !isAdmin) throw new ForbiddenException('NOT_ALLOWED');
    return s;
  }

  async update(
    groupId: string,
    suggestionId: string,
    userId: string,
    patch: { title?: string; type?: string; note?: string | null },
  ) {
    await this.assertCanModifySuggestion(groupId, suggestionId, userId);
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title.trim();
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.note !== undefined)
      data.note = patch.note?.trim() ? patch.note.trim() : null;
    return this.prisma.planSuggestion.update({
      where: { id: suggestionId },
      data: data as any,
      include: {
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async remove(groupId: string, suggestionId: string, userId: string) {
    await this.assertCanModifySuggestion(groupId, suggestionId, userId);
    await this.prisma.planSuggestion.delete({ where: { id: suggestionId } });
    return { ok: true as const };
  }

  async schedule(
    groupId: string,
    suggestionId: string,
    userId: string,
    input: {
      scheduledAt: Date;
      venueLabel?: string | null;
      requiresAllConfirm?: boolean;
      participants?: string[];
    },
  ) {
    const s = await this.prisma.planSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!s || s.groupId !== groupId) throw new NotFoundException('SUGGESTION_NOT_FOUND');
    await this.groups.requireMember(s.groupId, userId);

    const plan = await this.plans.createPlan({
      groupId: s.groupId,
      userId,
      title: s.title,
      type: s.type,
      scheduledAt: input.scheduledAt,
      venueLabel: input.venueLabel?.trim() || s.title,
      requiresAllConfirm: input.requiresAllConfirm,
      participants: input.participants,
    });

    await this.prisma.planSuggestion.delete({ where: { id: suggestionId } });

    return { planId: plan.id, plan };
  }
}
