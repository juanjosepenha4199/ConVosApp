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
  Min,
  ValidateNested,
} from 'class-validator';
import { PlanType } from '@prisma/client';

export class PlaceInputDto {
  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsString()
  lat!: string; // decimal string

  @IsString()
  lng!: string; // decimal string
}

export class CreatePlanDto {
  @IsString()
  title!: string;

  @IsEnum(PlanType)
  type!: PlanType;

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
  @ValidateNested()
  @Type(() => PlaceInputDto)
  place?: PlaceInputDto;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5000)
  locationRadiusM?: number;

  @IsOptional()
  @IsBoolean()
  requiresAllConfirm?: boolean;
}

export class CancelPlanDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
