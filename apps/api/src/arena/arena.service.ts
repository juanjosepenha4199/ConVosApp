import { Injectable } from '@nestjs/common';
import { GroupType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MS_DAY = 24 * 60 * 60 * 1000;

export type ArenaTier = 'bronze' | 'silver' | 'gold' | 'master' | 'legend';

function tierFromPoints30d(points30d: number): ArenaTier {
  if (points30d >= 6000) return 'legend';
  if (points30d >= 3000) return 'master';
  if (points30d >= 1500) return 'gold';
  if (points30d >= 500) return 'silver';
  return 'bronze';
}

@Injectable()
export class ArenaService {
  constructor(private readonly prisma: PrismaService) {}

  async leaderboard(input: { type: GroupType; days?: number; limit?: number }) {
    const days = input.days === 30 ? 30 : 7;
    const take = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const since = new Date(Date.now() - days * MS_DAY);
    const since30d = new Date(Date.now() - 30 * MS_DAY);

    const [rows, rows30d] = await Promise.all([
      this.prisma.pointsLedger.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: since }, group: { type: input.type } },
        _sum: { amount: true },
      }),
      this.prisma.pointsLedger.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: since30d }, group: { type: input.type } },
        _sum: { amount: true },
      }),
    ]);

    const points30dByGroup = new Map(
      rows30d.map((r) => [r.groupId, r._sum.amount ?? 0]),
    );
    const sorted = rows
      .map((r) => ({ groupId: r.groupId, points: r._sum.amount ?? 0 }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, take);

    const groups = await this.prisma.group.findMany({
      where: { id: { in: sorted.map((s) => s.groupId) } },
      select: { id: true, name: true, type: true },
    });
    const gmap = new Map(groups.map((g) => [g.id, g]));

    return sorted
      .map((s, i) => {
        const g = gmap.get(s.groupId);
        if (!g) return null;
        const p30 = points30dByGroup.get(s.groupId) ?? 0;
        return {
          rank: i + 1,
          group: g,
          points: s.points,
          tier: tierFromPoints30d(p30),
          points30d: p30,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }

  async myPositions(input: { userId: string; type: GroupType; days?: number }) {
    const days = input.days === 30 ? 30 : 7;
    const since = new Date(Date.now() - days * MS_DAY);
    const since30d = new Date(Date.now() - 30 * MS_DAY);

    const myGroups = await this.prisma.groupMember.findMany({
      where: { userId: input.userId, group: { type: input.type } },
      select: { groupId: true },
    });
    const myGroupIds = myGroups.map((g) => g.groupId);
    if (myGroupIds.length === 0) return [];

    const [rows, rows30d] = await Promise.all([
      this.prisma.pointsLedger.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: since }, group: { type: input.type } },
        _sum: { amount: true },
      }),
      this.prisma.pointsLedger.groupBy({
        by: ['groupId'],
        where: { createdAt: { gte: since30d }, group: { type: input.type } },
        _sum: { amount: true },
      }),
    ]);

    const points30dByGroup = new Map(
      rows30d.map((r) => [r.groupId, r._sum.amount ?? 0]),
    );
    const sorted = rows
      .map((r) => ({ groupId: r.groupId, points: r._sum.amount ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const rankByGroup = new Map(sorted.map((r, idx) => [r.groupId, idx + 1]));
    const pointsByGroup = new Map(sorted.map((r) => [r.groupId, r.points]));

    const groups = await this.prisma.group.findMany({
      where: { id: { in: myGroupIds } },
      select: { id: true, name: true, type: true },
    });
    const gmap = new Map(groups.map((g) => [g.id, g]));

    return myGroupIds
      .map((groupId) => {
        const g = gmap.get(groupId);
        if (!g) return null;
        const points = pointsByGroup.get(groupId) ?? 0;
        const rank = rankByGroup.get(groupId) ?? null;
        const p30 = points30dByGroup.get(groupId) ?? 0;
        return {
          group: g,
          points,
          rank,
          tier: tierFromPoints30d(p30),
          points30d: p30,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  }
}
