import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ValidationService } from './validation.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import * as path from 'path';
import { ValidationSubmitDto } from './dto/validation.dto';
import { mkdir, writeFile } from 'fs/promises';

function safeExt(mime?: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

@UseGuards(JwtAuthGuard)
@Controller()
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Post('plans/:planId/validation/init')
  init(@Request() req: any, @Param('planId') planId: string) {
    return this.validation.init(planId, req.user.userId);
  }

  @Post('plans/:planId/validation/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Request() req: any,
    @Param('planId') planId: string,
    @Query('photoId') photoId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!photoId) throw new Error('photoId required');
    if (!file) throw new Error('file required');

    const filename = `photo_${Date.now()}${safeExt(file.mimetype)}`;
    const outPath = path.join(process.cwd(), 'uploads', filename);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, file.buffer);

    const photo = await this.validation.attachUpload({
      planId,
      userId: req.user.userId,
      photoId,
      buffer: file.buffer ?? Buffer.alloc(0),
      filename,
    });
    return { ok: true, photo };
  }

  @Post('plans/:planId/validation/submit')
  submit(
    @Request() req: any,
    @Param('planId') planId: string,
    @Body() dto: ValidationSubmitDto,
  ) {
    return this.validation.submit({
      planId,
      userId: req.user.userId,
      photoId: dto.photoId,
      capturedAtClient: new Date(dto.capturedAtClient),
      lat: dto.lat,
      lng: dto.lng,
      gpsAccuracyM: dto.gpsAccuracyM,
      deviceInfo: dto.deviceInfo,
    });
  }

  @Get('plans/:planId/validation/status')
  status(@Request() req: any, @Param('planId') planId: string) {
    return this.validation.status(planId, req.user.userId);
  }
}
