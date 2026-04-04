import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PlanType } from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  title!: string;

  @IsEnum(PlanType)
  type!: PlanType;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueLabel?: string;

  @IsOptional()
  @IsBoolean()
  requiresAllConfirm?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];

  /** Fotos ya subidas (init + upload de galería). Máx. 8. Orden = orden en la galería. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID('4', { each: true })
  photoIds?: string[];
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  requiresAllConfirm?: boolean;
}

export class CancelPlanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
