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
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createLocalUser(input: CreateLocalUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
      },
    });
  }

  async upsertGoogleUser(input: UpsertGoogleUserInput) {
    const bySub = await this.prisma.user.findUnique({
      where: { googleSub: input.googleSub },
    });
    if (bySub) {
      return this.prisma.user.update({
        where: { id: bySub.id },
        data: {
          email: input.email,
          name: input.name ?? bySub.name,
          avatarUrl: input.avatarUrl ?? bySub.avatarUrl,
        },
      });
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (byEmail) {
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleSub: input.googleSub,
          name: input.name ?? byEmail.name,
          avatarUrl: input.avatarUrl ?? byEmail.avatarUrl,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email: input.email,
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
        avatarUrl: true,
        level: true,
        totalPoints: true,
      },
    });
    return user!;
  }

  async getProfileActivity(userId: string) {
    const user = await this.publicProfile(userId);
    const validations = await this.prisma.planValidation.findMany({
      where: { userId },
      orderBy: { submittedAtServer: 'desc' },
      take: 80,
      include: {
        photo: { select: { id: true, publicUrl: true } },
        plan: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            scheduledAt: true,
            group: { select: { id: true, name: true } },
            place: { select: { name: true } },
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
