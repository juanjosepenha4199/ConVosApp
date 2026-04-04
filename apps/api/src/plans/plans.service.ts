import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { GroupRole, PlanStatus } from '@prisma/client';
import { createHash } from 'crypto';

const galleryPhotoSelect = {
  id: true,
  publicUrl: true,
  mimeType: true,
} as const;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    @Optional() @InjectQueue('convos') private readonly convosQueue?: Queue,
  ) {}

  async initGalleryPhoto(groupId: string, userId: string) {
    await this.groups.requireMember(groupId, userId);
    const photo = await this.prisma.photo.create({
      data: {
        ownerUserId: userId,
        storageKey: `pending/gallery/${groupId}/${Date.now()}`,
      },
    });
    return {
      photoId: photo.id,
      uploadUrl: `/api/v1/groups/${groupId}/plans/gallery/upload?photoId=${photo.id}`,
    };
  }

  async attachGalleryUpload(input: {
    groupId: string;
    userId: string;
    photoId: string;
    buffer: Buffer;
    filename: string;
    mimeType: string | null;
  }) {
    await this.groups.requireMember(input.groupId, input.userId);
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

  async createPlan(input: {
    groupId: string;
    userId: string;
    title: string;
    type: any;
    scheduledAt: Date;
    venueLabel?: string | null;
    requiresAllConfirm?: boolean;
    participants?: string[];
    photoIds?: string[];
  }) {
    await this.groups.requireMember(input.groupId, input.userId);

    const participants = Array.from(
      new Set([input.userId, ...(input.participants ?? [])]),
    );

    const venue =
      input.venueLabel?.trim() ||
      (input.title?.trim() ? input.title.trim().slice(0, 200) : null);

    const seen = new Set<string>();
    const galleryIds: string[] = [];
    for (const id of input.photoIds ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        galleryIds.push(id);
      }
    }
    if (galleryIds.length > 8) throw new BadRequestException('TOO_MANY_PLAN_PHOTOS');

    if (galleryIds.length) {
      const photos = await this.prisma.photo.findMany({
        where: { id: { in: galleryIds } },
      });
      if (photos.length !== galleryIds.length)
        throw new NotFoundException('PHOTO_NOT_FOUND');
      const byId = new Map(photos.map((p) => [p.id, p]));
      for (const id of galleryIds) {
        const p = byId.get(id)!;
        if (p.ownerUserId !== input.userId)
          throw new ForbiddenException('NOT_OWNER');
        if (!p.publicUrl) throw new BadRequestException('PHOTO_NOT_UPLOADED');
      }
    }

    const plan = await this.prisma.plan.create({
      data: {
        groupId: input.groupId,
        createdBy: input.userId,
        title: input.title,
        type: input.type,
        scheduledAt: input.scheduledAt,
        venueLabel: venue,
        requiresAllConfirm: input.requiresAllConfirm ?? false,
        participants: {
          create: participants.map((userId) => ({
            userId,
            status: userId === input.userId ? 'accepted' : 'invited',
          })),
        },
        ...(galleryIds.length
          ? {
              galleryPhotos: {
                create: galleryIds.map((photoId, idx) => ({
                  photoId,
                  sortOrder: idx,
                })),
              },
            }
          : {}),
      },
      include: {
        participants: true,
        galleryPhotos: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...galleryPhotoSelect } } },
        },
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
      orderBy: { scheduledAt: 'asc' },
      include: {
        galleryPhotos: {
          orderBy: { sortOrder: 'asc' },
          take: 4,
          include: { photo: { select: { ...galleryPhotoSelect } } },
        },
      },
    });
  }

  async getPlan(planId: string, userId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        participants: true,
        galleryPhotos: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...galleryPhotoSelect } } },
        },
        validations: {
          orderBy: { submittedAtServer: 'desc' },
          include: {
            photo: { select: { id: true, publicUrl: true, mimeType: true } },
            attachments: {
              orderBy: { sortOrder: 'asc' },
              include: {
                photo: { select: { id: true, publicUrl: true, mimeType: true } },
              },
            },
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
    if (typeof patch.requiresAllConfirm === 'boolean')
      data.requiresAllConfirm = patch.requiresAllConfirm;
    if (patch.venueLabel !== undefined) {
      const v = patch.venueLabel;
      data.venueLabel =
        typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null;
    }

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data,
      include: {
        participants: true,
        galleryPhotos: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...galleryPhotoSelect } } },
        },
        validations: {
          orderBy: { submittedAtServer: 'desc' },
          include: {
            photo: { select: { id: true, publicUrl: true, mimeType: true } },
            attachments: {
              orderBy: { sortOrder: 'asc' },
              include: {
                photo: { select: { id: true, publicUrl: true, mimeType: true } },
              },
            },
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
