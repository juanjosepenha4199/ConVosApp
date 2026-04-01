import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChallengeAssignmentStatus,
  ChallengeScope,
  PointsReason,
  PlanType,
} from '@prisma/client';

type Rule =
  | { type: 'weekly_validations'; target: number }
  | { type: 'trip_once'; target: number };

function startOfWeekUtc(d: Date) {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfWeekUtc(start: Date) {
  const x = new Date(start);
  x.setUTCDate(x.getUTCDate() + 7);
  return x;
}

function levelFromPoints(total: number): number {
  if (total < 1000) return 1;
  if (total < 5000) return 2;
  if (total < 15000) return 3;
  return 4;
}

@Injectable()
export class ChallengesService {
  private readonly log = new Logger(ChallengesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedWeeklyChallenges() {
    const now = new Date();
    const start = startOfWeekUtc(now);
    const end = endOfWeekUtc(start);

    const existing = await this.prisma.challenge.findFirst({
      where: { startAt: start, title: 'Salir 3 veces esta semana' },
    });
    if (existing) {
      this.log.log('Weekly challenges already seeded for this week');
      return;
    }

    await this.prisma.challenge.createMany({
      data: [
        {
          scope: ChallengeScope.global,
          title: 'Salir 3 veces esta semana',
          description:
            'Completa 3 validaciones de planes en cualquiera de tus grupos.',
          rule: { type: 'weekly_validations', target: 3 } satisfies Rule,
          startAt: start,
          endAt: end,
          pointsReward: 200,
        },
        {
          scope: ChallengeScope.global,
          title: 'Prueba algo nuevo',
          description: 'Valida al menos 1 plan tipo viaje esta semana.',
          rule: { type: 'trip_once', target: 1 } satisfies Rule,
          startAt: start,
          endAt: end,
          pointsReward: 150,
        },
      ],
    });
    this.log.log('Weekly challenges created');
  }

  async ensureAssignments(userId: string, groupId: string) {
    const challenges = await this.prisma.challenge.findMany({
      where: { startAt: { lte: new Date() }, endAt: { gte: new Date() } },
    });

    for (const c of challenges) {
      const exists = await this.prisma.challengeAssignment.findFirst({
        where: { challengeId: c.id, userId, groupId },
      });
      if (exists) continue;

      const rule = c.rule as Rule;
      const target = rule.target;

      await this.prisma.challengeAssignment.create({
        data: {
          challengeId: c.id,
          userId,
          groupId,
          status: ChallengeAssignmentStatus.active,
          progress: { current: 0, target } as object,
        },
      });
    }
  }

  async listGroupChallenges(groupId: string, userId: string) {
    await this.ensureAssignments(userId, groupId);
    return this.prisma.challengeAssignment.findMany({
      where: { groupId, userId },
      include: { challenge: true },
      orderBy: { challengeId: 'asc' },
    });
  }

  async bumpOnValidationAccepted(
    userId: string,
    groupId: string,
    planType: PlanType,
  ) {
    await this.ensureAssignments(userId, groupId);

    const assignments = await this.prisma.challengeAssignment.findMany({
      where: {
        userId,
        groupId,
        status: ChallengeAssignmentStatus.active,
      },
      include: { challenge: true },
    });

    const weekStart = startOfWeekUtc(new Date());
    const validationsThisWeek = await this.prisma.planValidation.count({
      where: {
        userId,
        status: 'accepted',
        submittedAtServer: { gte: weekStart },
        plan: { groupId },
      },
    });

    for (const a of assignments) {
      const wasCompleted = a.status === ChallengeAssignmentStatus.completed;
      const rule = a.challenge.rule as Rule;
      const target = rule.target;
      let current = (a.progress as { current?: number })?.current ?? 0;

      if (rule.type === 'weekly_validations') {
        current = validationsThisWeek;
      } else if (rule.type === 'trip_once') {
        if (planType === PlanType.trip) {
          current = Math.min(target, current + 1);
        }
      }

      const done = current >= target;

      if (done && !wasCompleted) {
        await this.awardMission(
          userId,
          groupId,
          a.challenge.pointsReward,
          a.challenge.title,
        );
      }

      await this.prisma.challengeAssignment.update({
        where: { id: a.id },
        data: {
          progress: { current, target } as object,
          status: done
            ? ChallengeAssignmentStatus.completed
            : ChallengeAssignmentStatus.active,
          completedAt: done ? new Date() : null,
        },
      });
    }
  }

  private async awardMission(
    userId: string,
    groupId: string,
    points: number,
    title: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.pointsLedger.create({
        data: {
          userId,
          groupId,
          planId: null,
          amount: points,
          reason: PointsReason.mission_completed,
        },
      });
      const u = await tx.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } },
        select: { totalPoints: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { level: levelFromPoints(u.totalPoints) },
      });

      await tx.feedItem.create({
        data: {
          groupId,
          type: 'mission_completed',
          actorUserId: userId,
          occurredAt: new Date(),
          payload: { title },
        },
      });
    });
  }
}
