import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { IsConsumerEmail } from '../../common/validators/consumer-email.validator';

function trimLowerEmail({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterDto {
  @Transform(trimLowerEmail)
  @IsEmail()
  @IsConsumerEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @Transform(trimLowerEmail)
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class GoogleLoginDto {
  @IsString()
  idToken!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
