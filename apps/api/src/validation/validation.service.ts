import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService } from '../challenges/challenges.service';
import { createHash } from 'crypto';
import { PlanStatus, ValidationStatus } from '@prisma/client';

const photoForValidation = {
  id: true,
  publicUrl: true,
  mimeType: true,
} as const;

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly gamification: GamificationService,
    private readonly challenges: ChallengesService,
  ) {}

  async init(planId: string, userId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');
    await this.groups.requireMember(plan.groupId, userId);
    if (plan.status !== PlanStatus.scheduled)
      throw new ForbiddenException('PLAN_NOT_VALIDATABLE');

    const photo = await this.prisma.photo.create({
      data: {
        ownerUserId: userId,
        storageKey: `pending/${planId}/${Date.now()}`,
      },
    });

    return {
      photoId: photo.id,
      uploadUrl: `/api/v1/plans/${planId}/validation/upload?photoId=${photo.id}`,
      constraints: { maxSkewSeconds: 120 },
    };
  }

  async attachUpload(input: {
    planId: string;
    userId: string;
    photoId: string;
    buffer: Buffer;
    filename: string;
    mimeType: string | null;
  }) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: input.photoId },
    });
    if (!photo) throw new NotFoundException('PHOTO_NOT_FOUND');
    if (photo.ownerUserId !== input.userId)
      throw new ForbiddenException('NOT_OWNER');

    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    return this.prisma.photo.update({
      where: { id: input.photoId },
      data: {
        sha256,
        storageKey: input.filename,
        publicUrl: `/uploads/${input.filename}`,
        mimeType: input.mimeType,
      },
    });
  }

  async submit(input: {
    planId: string;
    userId: string;
    photoIds: string[];
    capturedAtClient: Date;
    deviceInfo?: any;
  }) {
    const seen = new Set<string>();
    const rawIds: string[] = [];
    for (const id of input.photoIds) {
      if (!seen.has(id)) {
        seen.add(id);
        rawIds.push(id);
      }
    }
    if (rawIds.length === 0) throw new BadRequestException('NO_PHOTOS');
    if (rawIds.length > 12) throw new BadRequestException('TOO_MANY_ATTACHMENTS');

    const primaryPhotoId = rawIds[0];

    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: { participants: true, validations: true },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');
    await this.groups.requireMember(plan.groupId, input.userId);
    if (plan.status !== PlanStatus.scheduled)
      throw new ForbiddenException('PLAN_NOT_VALIDATABLE');

    const photos = await this.prisma.photo.findMany({
      where: { id: { in: rawIds } },
    });
    if (photos.length !== rawIds.length)
      throw new NotFoundException('PHOTO_NOT_FOUND');

    const byId = new Map(photos.map((p) => [p.id, p]));
    for (const id of rawIds) {
      const p = byId.get(id)!;
      if (p.ownerUserId !== input.userId)
        throw new ForbiddenException('NOT_OWNER');
      if (!p.publicUrl) throw new BadRequestException('PHOTO_NOT_UPLOADED');
    }

    const now = new Date();
    const skewSeconds =
      Math.abs(now.getTime() - input.capturedAtClient.getTime()) / 1000;
    if (skewSeconds > 120) {
      return this.reject(
        plan.id,
        input.userId,
        primaryPhotoId,
        input.capturedAtClient,
        'TIME_SKEW',
      );
    }

    const existing = await this.prisma.planValidation.findUnique({
      where: { planId_userId: { planId: plan.id, userId: input.userId } },
    });
    if (existing) throw new BadRequestException('ALREADY_VALIDATED');

    const validation = await this.prisma.planValidation.create({
      data: {
        planId: plan.id,
        userId: input.userId,
        photoId: primaryPhotoId,
        capturedAtClient: input.capturedAtClient,
        status: ValidationStatus.accepted,
        metadata: input.deviceInfo ?? undefined,
        attachments:
          rawIds.length > 1
            ? {
                create: rawIds.slice(1).map((photoId, idx) => ({
                  photoId,
                  sortOrder: idx,
                })),
              }
            : undefined,
      },
      include: {
        photo: { select: { ...photoForValidation } },
        attachments: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...photoForValidation } } },
        },
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.feedItem.create({
      data: {
        groupId: plan.groupId,
        type: 'plan_validated',
        planId: plan.id,
        photoId: primaryPhotoId,
        actorUserId: input.userId,
        occurredAt: now,
        payload: {
          title: plan.title,
          type: plan.type,
          venueLabel: plan.venueLabel,
          mediaCount: rawIds.length,
        },
      },
    });

    await this.gamification.onValidationAccepted({
      userId: input.userId,
      groupId: plan.groupId,
      planId: plan.id,
      planType: plan.type,
    });

    await this.challenges.bumpOnValidationAccepted(
      input.userId,
      plan.groupId,
      plan.type,
    );

    await this.maybeCompletePlan(plan.id);

    return { status: 'accepted', validation };
  }

  private async reject(
    planId: string,
    userId: string,
    photoId: string,
    capturedAtClient: Date,
    reason: string,
  ) {
    const existing = await this.prisma.planValidation.findUnique({
      where: { planId_userId: { planId, userId } },
    });
    if (existing) throw new BadRequestException('ALREADY_VALIDATED');

    const validation = await this.prisma.planValidation.create({
      data: {
        planId,
        userId,
        photoId,
        capturedAtClient,
        status: ValidationStatus.rejected,
        rejectReason: reason,
      },
    });

    return { status: 'rejected', reason, validation };
  }

  private async maybeCompletePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { participants: true, validations: true },
    });
    if (!plan) return;
    if (plan.status !== PlanStatus.scheduled) return;

    const acceptedUserIds = new Set(
      plan.validations
        .filter((v) => v.status === ValidationStatus.accepted)
        .map((v) => v.userId),
    );

    let completed = false;
    if (plan.requiresAllConfirm) {
      completed = plan.participants.every((p) => acceptedUserIds.has(p.userId));
    } else {
      completed = acceptedUserIds.size >= 1;
    }

    if (completed) {
      await this.prisma.plan.update({
        where: { id: planId },
        data: { status: PlanStatus.completed },
      });
    }
  }

  status(planId: string, userId: string) {
    return this.prisma.planValidation.findMany({
      where: { planId, plan: { group: { members: { some: { userId } } } } },
      orderBy: { submittedAtServer: 'desc' },
      include: {
        photo: { select: { ...photoForValidation } },
        attachments: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...photoForValidation } } },
        },
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }
}
