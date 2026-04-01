import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChallengesService } from '../challenges/challenges.service';

@Injectable()
export class JobsSchedulerService implements OnModuleInit {
  private readonly log = new Logger(JobsSchedulerService.name);

  constructor(
    @InjectQueue('convos') private readonly convosQueue: Queue,
    private readonly challenges: ChallengesService,
  ) {}

  async onModuleInit() {
    await this.challenges
      .seedWeeklyChallenges()
      .catch((e) => this.log.warn(`seedWeekly: ${e}`));

    try {
      await this.convosQueue.add(
        'weekly_seed',
        {},
        {
          repeat: { pattern: '0 9 * * 1' },
          jobId: 'repeat-weekly-seed',
        },
      );
      await this.convosQueue.add(
        'inactivity_scan',
        {},
        {
          repeat: { pattern: '0 10 * * *' },
          jobId: 'repeat-inactivity',
        },
      );
      this.log.log('BullMQ repeatable jobs registered');
    } catch (e: any) {
      this.log.warn(`Repeatable jobs (Redis?): ${e?.message ?? e}`);
    }
  }
}
