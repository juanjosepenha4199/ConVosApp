import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChallengesService } from '../challenges/challenges.service';

@Processor('convos', { concurrency: 5 })
export class ConvosJobsProcessor extends WorkerHost {
  private readonly log = new Logger(ConvosJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly challenges: ChallengesService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'weekly_seed':
        await this.challenges.seedWeeklyChallenges();
        return;
      case 'inactivity_scan':
        await this.runInactivityScan();
        return;
      case 'plan_reminder':
        await this.sendPlanReminder(job.data?.planId as string);
        return;
      default:
        this.log.warn(`Unknown job name: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.log.error(`Job ${job.id} failed: ${err.message}`, err.stack);
  }

  private async sendPlanReminder(planId: string) {
    if (!planId) return;
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { group: true },
    });
    if (!plan || plan.status !== 'scheduled') return;

    const members = await this.prisma.groupMember.findMany({
      where: { groupId: plan.groupId },
      select: { userId: true },
    });

    const title = 'Recordatorio de plan';
    const where = plan.venueLabel?.trim() ? ` · ${plan.venueLabel.trim()}` : '';
    const body = `${plan.title}${where} · ${new Date(plan.scheduledAt).toLocaleString('es')}`;

    for (const m of members) {
      await this.notifications.sendToUser(m.userId, {
        title,
        body,
        tag: `plan-${plan.id}`,
      });
    }
  }

  private async runInactivityScan() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.planValidation.findMany({
      where: { submittedAtServer: { gte: since }, status: 'accepted' },
      select: { userId: true },
      distinct: ['userId'],
    });
    const active = new Set(recent.map((r) => r.userId));
    const users = await this.prisma.user.findMany({
      where: { pushSubs: { some: { revokedAt: null } } },
      select: { id: true },
    });
    for (const u of users) {
      if (active.has(u.id)) continue;
      await this.notifications.sendToUser(u.id, {
        title: 'Te echamos de menos en ConVos',
        body: 'Agenda un plan esta semana y mantén la racha con tu grupo.',
        tag: 'inactivity',
      });
    }
  }
}
