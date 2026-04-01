import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

function redisConnection(config: ConfigService) {
  const raw = config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 6379,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config),
      }),
    }),
    BullModule.registerQueue({ name: 'convos' }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
