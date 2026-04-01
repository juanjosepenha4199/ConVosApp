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

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
      include: { place: true },
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
      constraints: {
        maxSkewSeconds: 120,
        radiusM: plan.locationRadiusM,
      },
    };
  }

  async attachUpload(input: {
    planId: string;
    userId: string;
    photoId: string;
    buffer: Buffer;
    filename: string;
  }) {
    const photo = await this.prisma.photo.findUnique({
      where: { id: input.photoId },
    });
    if (!photo) throw new NotFoundException('PHOTO_NOT_FOUND');
    if (photo.ownerUserId !== input.userId)
      throw new ForbiddenException('NOT_OWNER');

    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    // Keep storageKey as final file name; controller decides path
    return this.prisma.photo.update({
      where: { id: input.photoId },
      data: {
        sha256,
        storageKey: input.filename,
        publicUrl: `/uploads/${input.filename}`,
      },
    });
  }

  async submit(input: {
    planId: string;
    userId: string;
    photoId: string;
    capturedAtClient: Date;
    lat: number;
    lng: number;
    gpsAccuracyM?: number;
    deviceInfo?: any;
  }) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId },
      include: { place: true, participants: true, validations: true },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');
    await this.groups.requireMember(plan.groupId, input.userId);
    if (plan.status !== PlanStatus.scheduled)
      throw new ForbiddenException('PLAN_NOT_VALIDATABLE');

    const photo = await this.prisma.photo.findUnique({
      where: { id: input.photoId },
    });
    if (!photo) throw new NotFoundException('PHOTO_NOT_FOUND');
    if (photo.ownerUserId !== input.userId)
      throw new ForbiddenException('NOT_OWNER');
    if (!photo.publicUrl) throw new BadRequestException('PHOTO_NOT_UPLOADED');

    const now = new Date();
    const skewSeconds =
      Math.abs(now.getTime() - input.capturedAtClient.getTime()) / 1000;
    if (skewSeconds > 120) {
      return this.reject(
        plan.id,
        input.userId,
        input.photoId,
        input.capturedAtClient,
        input.lat,
        input.lng,
        0,
        'TIME_SKEW',
      );
    }

    const planLat = Number(plan.place.lat);
    const planLng = Number(plan.place.lng);
    const dist = Math.round(
      haversineMeters(input.lat, input.lng, planLat, planLng),
    );

    if (input.gpsAccuracyM && input.gpsAccuracyM > 200) {
      return this.reject(
        plan.id,
        input.userId,
        input.photoId,
        input.capturedAtClient,
        input.lat,
        input.lng,
        dist,
        'GPS_ACCURACY_LOW',
      );
    }

    if (dist > plan.locationRadiusM) {
      return this.reject(
        plan.id,
        input.userId,
        input.photoId,
        input.capturedAtClient,
        input.lat,
        input.lng,
        dist,
        'TOO_FAR',
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
        photoId: input.photoId,
        capturedAtClient: input.capturedAtClient,
        lat: input.lat.toString(),
        lng: input.lng.toString(),
        distanceToPlanM: dist,
        status: ValidationStatus.accepted,
        metadata: input.deviceInfo ?? undefined,
      },
    });

    await this.prisma.feedItem.create({
      data: {
        groupId: plan.groupId,
        type: 'plan_validated',
        planId: plan.id,
        photoId: input.photoId,
        actorUserId: input.userId,
        occurredAt: now,
        payload: {
          title: plan.title,
          type: plan.type,
          placeName: plan.place.name,
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
    lat: number,
    lng: number,
    distanceToPlanM: number,
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
        lat: lat.toString(),
        lng: lng.toString(),
        distanceToPlanM,
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
    });
  }
}
