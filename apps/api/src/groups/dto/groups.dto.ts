import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GroupType } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  name!: string;

  @IsEnum(GroupType)
  type!: GroupType;
}

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;
}
