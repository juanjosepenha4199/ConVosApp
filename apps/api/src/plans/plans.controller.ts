import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlansService } from './plans.service';
import { CancelPlanDto, CreatePlanDto, UpdatePlanDto } from './dto/plans.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { UPLOADS_ABSOLUTE_DIR } from '../uploads-dir';
import { mkdir, writeFile } from 'fs/promises';
import { safeExtFromMime } from '../common/safe-upload-ext';

@UseGuards(JwtAuthGuard)
@Controller()
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post('groups/:groupId/plans/gallery/init')
  initGallery(@Request() req: any, @Param('groupId') groupId: string) {
    return this.plans.initGalleryPhoto(groupId, req.user.userId);
  }

  @Post('groups/:groupId/plans/gallery/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadGallery(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('photoId') photoId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!photoId) throw new Error('photoId required');
    if (!file) throw new Error('file required');

    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const filename = `plan_gallery_${stamp}${safeExtFromMime(file.mimetype)}`;
    const outPath = path.join(UPLOADS_ABSOLUTE_DIR, filename);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, file.buffer);

    const photo = await this.plans.attachGalleryUpload({
      groupId,
      userId: req.user.userId,
      photoId,
      buffer: file.buffer ?? Buffer.alloc(0),
      filename,
      mimeType: file.mimetype || null,
    });
    return { ok: true, photo };
  }

  @Post('groups/:groupId/plans')
  create(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.createPlan({
      groupId,
      userId: req.user.userId,
      title: dto.title,
      type: dto.type,
      scheduledAt: new Date(dto.scheduledAt),
      venueLabel: dto.venueLabel,
      requiresAllConfirm: dto.requiresAllConfirm,
      participants: dto.participants,
      photoIds: dto.photoIds,
    });
  }

  @Get('groups/:groupId/plans')
  list(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.plans.listGroupPlans({
      groupId,
      userId: req.user.userId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('plans/:planId')
  get(@Request() req: any, @Param('planId') planId: string) {
    return this.plans.getPlan(planId, req.user.userId);
  }

  @Patch('plans/:planId')
  update(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.updatePlan(planId, req.user.userId, {
      ...dto,
      ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
    });
  }

  @Post('plans/:planId/cancel')
  cancel(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() dto: CancelPlanDto,
  ) {
    return this.plans.cancelPlan(planId, req.user.userId, dto.reason);
  }
}
