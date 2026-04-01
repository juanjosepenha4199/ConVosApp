import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private configured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const pub = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    const priv = this.config.get<string>('VAPID_PRIVATE_KEY') ?? '';
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@convos.local';
    if (pub && priv) {
      webpush.setVapidDetails(subject, pub, priv);
      this.configured = true;
    } else {
      this.log.warn('VAPID keys not set — Web Push disabled');
    }
  }

  getPublicVapidKey() {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  async subscribe(
    userId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.prisma.notificationSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        revokedAt: null,
      },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.notificationSubscription.updateMany({
      where: { userId, endpoint },
      data: { revokedAt: new Date() },
    });
  }

  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      tag?: string;
      data?: Record<string, string>;
    },
  ) {
    if (!this.configured) return;

    const subs = await this.prisma.notificationSubscription.findMany({
      where: { userId, revokedAt: null },
    });

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      data: payload.data,
    });

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
        );
      } catch (e: any) {
        this.log.warn(`Push failed for ${s.endpoint}: ${e?.message ?? e}`);
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await this.prisma.notificationSubscription.update({
            where: { id: s.id },
            data: { revokedAt: new Date() },
          });
        }
      }
    }
  }
}
