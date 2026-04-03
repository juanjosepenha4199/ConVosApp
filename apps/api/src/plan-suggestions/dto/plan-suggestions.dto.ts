import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlanType } from '@prisma/client';
import { PlaceInputDto } from '../../plans/dto/plans.dto';

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

  @ValidateNested()
  @Type(() => PlaceInputDto)
  place!: PlaceInputDto;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  locationRadiusM?: number;

  @IsOptional()
  @IsBoolean()
  requiresAllConfirm?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];
}
