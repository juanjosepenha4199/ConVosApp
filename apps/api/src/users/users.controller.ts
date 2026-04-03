import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

function safeAvatarExt(mime?: string) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  me(@Request() req: any) {
    return this.users.publicProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch()
  patchMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, {
      name: dto.name,
      bio: dto.bio,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('FILE_REQUIRED');
    const mime = file.mimetype;
    if (!mime?.startsWith('image/')) throw new BadRequestException('INVALID_IMAGE_TYPE');

    const userId = req.user.userId as string;
    const filename = `avatar_${userId.slice(0, 8)}_${Date.now()}${safeAvatarExt(mime)}`;
    const outPath = path.join(process.cwd(), 'uploads', filename);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, file.buffer);

    const publicUrl = `/uploads/${filename}`;
    return this.users.setAvatarUrl(userId, publicUrl);
  }

  @UseGuards(JwtAuthGuard)
  @Get('activity')
  activity(@Request() req: any) {
    return this.users.getProfileActivity(req.user.userId);
  }
}
