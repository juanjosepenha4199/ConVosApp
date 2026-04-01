import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { GroupsController } from './groups/groups.controller';
import { GroupsService } from './groups/groups.service';
import { PlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';
import { ValidationController } from './validation/validation.controller';
import { ValidationService } from './validation/validation.service';
import { GamificationController } from './gamification/gamification.controller';
import { GamificationService } from './gamification/gamification.service';
import { QueueModule } from './queue/queue.module';
import { JobsModule } from './jobs/jobs.module';
import { ChallengesController } from './challenges/challenges.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { FeedController } from './feed/feed.controller';
import { FeedService } from './feed/feed.service';
import { ArenaController } from './arena/arena.controller';
import { ArenaService } from './arena/arena.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    QueueModule,
    JobsModule,
    AuthModule,
  ],
  controllers: [
    AppController,
    UsersController,
    GroupsController,
    PlansController,
    ValidationController,
    GamificationController,
    ChallengesController,
    NotificationsController,
    FeedController,
    ArenaController,
  ],
  providers: [
    AppService,
    UsersService,
    GroupsService,
    PlansService,
    ValidationService,
    GamificationService,
    FeedService,
    ArenaService,
  ],
})
export class AppModule {}
