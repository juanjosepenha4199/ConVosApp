import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PlanType } from '@prisma/client';

export class CreatePlanSuggestionDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsEnum(PlanType)
  type!: PlanType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdatePlanSuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(PlanType)
  type?: PlanType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class SchedulePlanSuggestionDto {
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
}
