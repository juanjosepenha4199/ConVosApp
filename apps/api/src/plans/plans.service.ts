import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { Decimal } from '@prisma/client/runtime/library';
import { GroupRole, PlanStatus } from '@prisma/client';
import { nanoid } from 'nanoid';

type PlaceInput = {
  googlePlaceId?: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    @Optional() @InjectQueue('convos') private readonly convosQueue?: Queue,
  ) {}

  private toDecimal(s: string) {
    return new Decimal(s);
  }

  async upsertPlace(input: PlaceInput) {
    const key = input.googlePlaceId?.trim() || `manual_${nanoid(12)}`;
    return this.prisma.place.upsert({
      where: { googlePlaceId: key },
      update: {
        name: input.name,
        address: input.address,
        lat: this.toDecimal(input.lat),
        lng: this.toDecimal(input.lng),
      },
      create: {
        googlePlaceId: key,
        name: input.name,
        address: input.address,
        lat: this.toDecimal(input.lat),
        lng: this.toDecimal(input.lng),
      },
    });
  }

  async createPlan(input: {
    groupId: string;
    userId: string;
    title: string;
    type: any;
    scheduledAt: Date;
    place: PlaceInput;
    locationRadiusM?: number;
    requiresAllConfirm?: boolean;
    participants?: string[];
  }) {
    await this.groups.requireMember(input.groupId, input.userId);
    const place = await this.upsertPlace(input.place);

    const participants = Array.from(
      new Set([input.userId, ...(input.participants ?? [])]),
    );

    const plan = await this.prisma.plan.create({
      data: {
        groupId: input.groupId,
        createdBy: input.userId,
        title: input.title,
        type: input.type,
        scheduledAt: input.scheduledAt,
        placeId: place.id,
        locationRadiusM: input.locationRadiusM ?? 250,
        requiresAllConfirm: input.requiresAllConfirm ?? false,
        participants: {
          create: participants.map((userId) => ({
            userId,
            status: userId === input.userId ? 'accepted' : 'invited',
          })),
        },
      },
      include: {
        place: true,
        participants: true,
      },
    });

    const t = plan.scheduledAt.getTime();
    const now = Date.now();
    if (this.convosQueue) {
      const ms24h = t - now - 24 * 60 * 60 * 1000;
      const ms2h = t - now - 2 * 60 * 60 * 1000;
      if (ms24h > 60_000) {
        await this.convosQueue.add(
          'plan_reminder',
          { planId: plan.id },
          { delay: ms24h },
        );
      }
      if (ms2h > 60_000 && ms2h !== ms24h) {
        await this.convosQueue.add(
          'plan_reminder',
          { planId: plan.id },
          { delay: ms2h },
        );
      }
    }

    return plan;
  }

  listGroupPlans(input: {
    groupId: string;
    userId: string;
    from?: Date;
    to?: Date;
  }) {
    return this.prisma.plan.findMany({
      where: {
        groupId: input.groupId,
        group: { members: { some: { userId: input.userId } } },
        ...(input.from || input.to
          ? {
              scheduledAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      include: { place: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getPlan(planId: string, userId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        place: true,
        participants: true,
        validations: {
          orderBy: { submittedAtServer: 'desc' },
          include: {
            photo: { select: { id: true, publicUrl: true } },
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');
    const member = await this.groups.requireMember(plan.groupId, userId);
    const canEdit =
      plan.status === PlanStatus.scheduled &&
      (plan.createdBy === userId || member.role === GroupRole.admin);
    return { ...plan, canEdit };
  }

  private async canEdit(planId: string, userId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');
    const member = await this.groups.requireMember(plan.groupId, userId);
    const isCreator = plan.createdBy === userId;
    const isAdmin = member.role === 'admin';
    if (!isCreator && !isAdmin) throw new ForbiddenException('NOT_ALLOWED');
    return plan;
  }

  async updatePlan(planId: string, userId: string, patch: any) {
    const plan = await this.canEdit(planId, userId);
    if (plan.status !== PlanStatus.scheduled)
      throw new ForbiddenException('PLAN_NOT_EDITABLE');

    const data: any = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.scheduledAt !== undefined)
      data.scheduledAt = new Date(patch.scheduledAt);
    if (patch.locationRadiusM !== undefined)
      data.locationRadiusM = patch.locationRadiusM;
    if (typeof patch.requiresAllConfirm === 'boolean')
      data.requiresAllConfirm = patch.requiresAllConfirm;
    if (patch.place) {
      const place = await this.upsertPlace(patch.place);
      data.placeId = place.id;
    }

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data,
      include: {
        place: true,
        participants: true,
        validations: {
          orderBy: { submittedAtServer: 'desc' },
          include: {
            photo: { select: { id: true, publicUrl: true } },
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });
    const memberAfter = await this.groups.requireMember(updated.groupId, userId);
    const canEdit =
      updated.status === PlanStatus.scheduled &&
      (updated.createdBy === userId || memberAfter.role === GroupRole.admin);
    return { ...updated, canEdit };
  }

  async cancelPlan(planId: string, userId: string, reason?: string) {
    const plan = await this.canEdit(planId, userId);
    if (plan.status !== PlanStatus.scheduled)
      throw new ForbiddenException('PLAN_NOT_CANCELLABLE');

    return this.prisma.plan.update({
      where: { id: planId },
      data: {
        status: PlanStatus.cancelled,
        cancelledBy: userId,
        cancelledReason: reason ?? null,
      },
    });
  }
}
