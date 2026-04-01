import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ValidationInitDto {
  @IsOptional()
  @IsISO8601()
  capturedAtClient?: string;
}

export class ValidationSubmitDto {
  @IsString()
  photoId!: string;

  @IsISO8601()
  capturedAtClient!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  gpsAccuracyM?: number;

  @IsOptional()
  deviceInfo?: any;
}
