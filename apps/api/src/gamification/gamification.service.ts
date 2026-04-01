import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, PointsReason, Prisma } from '@prisma/client';

function levelFromPoints(total: number): number {
  if (total < 1000) return 1;
  if (total < 5000) return 2;
  if (total < 15000) return 3;
  return 4;
}

const MS_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async onValidationAccepted(input: {
    userId: string;
    groupId: string;
    planId: string;
    planType: PlanType;
  }) {
    const base = 100;
    const creative = input.planType === PlanType.trip ? 50 : 0;
    const totalDelta = base + creative;

    await this.prisma.$transaction(async (tx) => {
      await tx.pointsLedger.create({
        data: {
          userId: input.userId,
          groupId: input.groupId,
          planId: input.planId,
          amount: base,
          reason: PointsReason.plan_completed,
        },
      });
      if (creative > 0) {
        await tx.pointsLedger.create({
          data: {
            userId: input.userId,
            groupId: input.groupId,
            planId: input.planId,
            amount: creative,
            reason: PointsReason.creative_bonus,
          },
        });
      }

      let user = await tx.user.update({
        where: { id: input.userId },
        data: { totalPoints: { increment: totalDelta } },
        select: { totalPoints: true },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { level: levelFromPoints(user.totalPoints) },
      });

      const streakBonus = await this.computeStreakBonusTx(
        tx,
        input.userId,
        input.groupId,
      );
      if (streakBonus > 0) {
        await tx.pointsLedger.create({
          data: {
            userId: input.userId,
            groupId: input.groupId,
            planId: null,
            amount: streakBonus,
            reason: PointsReason.streak_bonus,
          },
        });
        user = await tx.user.update({
          where: { id: input.userId },
          data: { totalPoints: { increment: streakBonus } },
          select: { totalPoints: true },
        });
        await tx.user.update({
          where: { id: input.userId },
          data: { level: levelFromPoints(user.totalPoints) },
        });
      }
    });
  }

  private async computeStreakBonusTx(
    tx: Prisma.TransactionClient,
    userId: string,
    _groupId: string,
  ): Promise<number> {
    const now = new Date();
    const existing = await tx.streak.findUnique({ where: { userId } });

    if (!existing) {
      await tx.streak.create({
        data: {
          userId,
          currentStreak: 1,
          bestStreak: 1,
          lastValidatedAt: now,
        },
      });
      return 0;
    }

    const last = existing.lastValidatedAt;
    let current = existing.currentStreak;
    let best = existing.bestStreak;

    if (!last) {
      current = 1;
    } else {
      const days = (now.getTime() - last.getTime()) / MS_DAY;
      if (days <= 7) {
        current += 1;
      } else {
        current = 1;
      }
    }
    best = Math.max(best, current);
    const bonus = Math.min(current, 7) * 20;

    await tx.streak.update({
      where: { userId },
      data: { currentStreak: current, bestStreak: best, lastValidatedAt: now },
    });

    return bonus;
  }

  async leaderboard(groupId: string, userId: string, days = 7) {
    await this.prisma.groupMember.findFirstOrThrow({
      where: { groupId, userId },
    });
    const since = new Date(Date.now() - days * MS_DAY);
    const rows = await this.prisma.pointsLedger.groupBy({
      by: ['userId'],
      where: { groupId, createdAt: { gte: since } },
      _sum: { amount: true },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        totalPoints: true,
        level: true,
      },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    return rows
      .map((r) => ({
        user: map.get(r.userId),
        weekPoints: r._sum.amount ?? 0,
      }))
      .filter((x) => x.user)
      .sort((a, b) => b.weekPoints - a.weekPoints);
  }
}
