import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ValidationInitDto {
  @IsOptional()
  @IsISO8601()
  capturedAtClient?: string;
}

export class ValidationSubmitDto {
  /** Una o más fotos/archivos ya subidos (init + upload por cada uno). Máx. 12. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsUUID('4', { each: true })
  photoIds!: string[];

  @IsISO8601()
  capturedAtClient!: string;

  @IsOptional()
  deviceInfo?: any;
}
