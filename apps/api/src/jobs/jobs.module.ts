import { Module } from '@nestjs/common';
import { ConvosJobsProcessor } from './jobs.processor';
import { JobsSchedulerService } from './jobs.scheduler.service';
import { ChallengesService } from '../challenges/challenges.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  providers: [
    ConvosJobsProcessor,
    JobsSchedulerService,
    ChallengesService,
    NotificationsService,
  ],
  exports: [ChallengesService, NotificationsService],
})
export class JobsModule {}
