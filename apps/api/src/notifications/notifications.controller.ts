import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsObject, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

class SubscribeDto {
  @IsString()
  endpoint!: string;

  @IsObject()
  keys!: { p256dh: string; auth: string };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Público: el service worker necesita la clave antes o sin sesión. */
  @Get('vapid-public-key')
  vapid() {
    return { publicKey: this.notifications.getPublicVapidKey() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Request() req: any, @Body() dto: SubscribeDto) {
    return this.notifications.subscribe(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('unsubscribe')
  unsubscribe(@Request() req: any, @Body() body: { endpoint: string }) {
    return this.notifications.unsubscribe(req.user.userId, body.endpoint);
  }
}
