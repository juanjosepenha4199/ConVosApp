import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupRole } from '@prisma/client';
import { nanoid } from 'nanoid';

const galleryPhotoSelect = {
  id: true,
  publicUrl: true,
  mimeType: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(input: { userId: string; name: string; type: any }) {
    return this.prisma.group.create({
      data: {
        name: input.name,
        type: input.type,
        createdBy: input.userId,
        members: {
          create: {
            userId: input.userId,
            role: GroupRole.admin,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  listMyGroups(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGroupOrThrow(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
    return group;
  }

  async requireMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
    if (!member) throw new ForbiddenException('NOT_A_MEMBER');
    return member;
  }

  async requireAdmin(groupId: string, userId: string) {
    const member = await this.requireMember(groupId, userId);
    if (member.role !== GroupRole.admin)
      throw new ForbiddenException('NOT_ADMIN');
    return member;
  }

  async createInviteLink(input: {
    groupId: string;
    userId: string;
    expiresInDays?: number;
    maxUses?: number;
  }) {
    await this.requireAdmin(input.groupId, input.userId);

    const token = nanoid(32);
    const expiresInDays = input.expiresInDays ?? 14;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    const invite = await this.prisma.groupInvite.create({
      data: {
        groupId: input.groupId,
        createdBy: input.userId,
        token,
        expiresAt,
        maxUses: input.maxUses ?? null,
      },
    });

    return invite;
  }

  async joinByInviteToken(input: { token: string; userId: string }) {
    const invite = await this.prisma.groupInvite.findUnique({
      where: { token: input.token },
      include: { group: true },
    });
    if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');

    const now = new Date();
    if (invite.expiresAt <= now) throw new ForbiddenException('INVITE_EXPIRED');
    if (invite.maxUses !== null && invite.uses >= invite.maxUses)
      throw new ForbiddenException('INVITE_MAX_USES');

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.upsert({
        where: {
          groupId_userId: { groupId: invite.groupId, userId: input.userId },
        },
        update: {},
        create: {
          groupId: invite.groupId,
          userId: input.userId,
          role: GroupRole.member,
        },
      });

      await tx.groupInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });
    });

    return { groupId: invite.groupId };
  }

  async listMembers(groupId: string, requesterId: string) {
    await this.requireMember(groupId, requesterId);
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            bio: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  /** Una fila por imagen/archivo (principal + adjuntos), más recientes primero. */
  async listValidationGallery(groupId: string, userId: string, limit = 24) {
    await this.requireMember(groupId, userId);
    const take = Math.min(Math.max(Number(limit) || 24, 1), 80);
    const scanValidations = Math.min(take * 4, 120);

    const validations = await this.prisma.planValidation.findMany({
      where: {
        plan: { groupId },
        photo: { publicUrl: { not: null } },
      },
      orderBy: { submittedAtServer: 'desc' },
      take: scanValidations,
      include: {
        photo: { select: { ...galleryPhotoSelect } },
        attachments: {
          orderBy: { sortOrder: 'asc' },
          include: { photo: { select: { ...galleryPhotoSelect } } },
        },
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        plan: { select: { id: true, title: true } },
      },
    });

    type Row = {
      id: string;
      validationId: string;
      status: string;
      submittedAtServer: Date;
      photo: { id: string; publicUrl: string | null; mimeType: string | null };
      user: { id: string; name: string | null; email: string; avatarUrl: string | null };
      plan: { id: string; title: string };
    };

    const flat: Row[] = [];
    outer: for (const v of validations) {
      if (v.photo.publicUrl) {
        flat.push({
          id: v.photo.id,
          validationId: v.id,
          status: v.status,
          submittedAtServer: v.submittedAtServer,
          photo: v.photo,
          user: v.user,
          plan: v.plan,
        });
        if (flat.length >= take) break outer;
      }
      for (const a of v.attachments) {
        if (a.photo.publicUrl) {
          flat.push({
            id: a.photo.id,
            validationId: v.id,
            status: v.status,
            submittedAtServer: v.submittedAtServer,
            photo: a.photo,
            user: v.user,
            plan: v.plan,
          });
          if (flat.length >= take) break outer;
        }
      }
    }

    return flat;
  }
}
