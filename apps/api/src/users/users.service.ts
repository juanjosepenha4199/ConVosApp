import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateLocalUserInput = {
  email: string;
  passwordHash: string;
  name: string | null;
};

type UpsertGoogleUserInput = {
  googleSub: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type CreateRefreshTokenInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    return this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createLocalUser(input: CreateLocalUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        name: input.name,
      },
    });
  }

  async upsertGoogleUser(input: UpsertGoogleUserInput) {
    const emailNorm = input.email.trim().toLowerCase();
    const bySub = await this.prisma.user.findUnique({
      where: { googleSub: input.googleSub },
    });
    if (bySub) {
      return this.prisma.user.update({
        where: { id: bySub.id },
        data: {
          email: emailNorm,
          name: input.name ?? bySub.name,
          avatarUrl: input.avatarUrl ?? bySub.avatarUrl,
        },
      });
    }

    const byEmail = await this.prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' } },
    });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          email: emailNorm,
          googleSub: input.googleSub,
          name: input.name ?? byEmail.name,
          avatarUrl: input.avatarUrl ?? byEmail.avatarUrl,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email: emailNorm,
        googleSub: input.googleSub,
        name: input.name,
        avatarUrl: input.avatarUrl,
      },
    });
  }

  createRefreshToken(input: CreateRefreshTokenInput) {
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  revokeRefreshToken(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });
  }

  async publicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        level: true,
        totalPoints: true,
      },
    });
    return user!;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; bio?: string | null },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name || null } : {}),
        ...(data.bio !== undefined ? { bio: data.bio?.trim() ? data.bio.trim() : null } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        level: true,
        totalPoints: true,
      },
    });
  }

  async setAvatarUrl(userId: string, publicUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
        level: true,
        totalPoints: true,
      },
    });
  }

  async getProfileActivity(userId: string) {
    const user = await this.publicProfile(userId);
    const validations = await this.prisma.planValidation.findMany({
      where: { userId },
      orderBy: { submittedAtServer: 'desc' },
      take: 80,
      include: {
        photo: { select: { id: true, publicUrl: true, mimeType: true } },
        attachments: {
          orderBy: { sortOrder: 'asc' },
          include: {
            photo: { select: { id: true, publicUrl: true, mimeType: true } },
          },
        },
        plan: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            venueLabel: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
    });
    const pointsLedger = await this.prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        group: { select: { id: true, name: true } },
        plan: { select: { id: true, title: true } },
      },
    });
    return { user, validations, pointsLedger };
  }
}
