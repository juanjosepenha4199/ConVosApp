import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import {
  LoginDto,
  RegisterDto,
  GoogleLoginDto,
  RefreshDto,
} from './dto/auth.dto';
import { JwtAccessPayload } from './types';

function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.googleClient = new OAuth2Client(clientId || undefined);
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new BadRequestException('EMAIL_ALREADY_IN_USE');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.users.createLocalUser({
      email: dto.email,
      passwordHash,
      name: dto.name ?? null,
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.passwordHash)
      throw new UnauthorizedException('INVALID_CREDENTIALS');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');

    return this.issueTokens(user.id, user.email);
  }

  async googleLogin(dto: GoogleLoginDto) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    if (!clientId)
      throw new BadRequestException('GOOGLE_CLIENT_ID_NOT_CONFIGURED');

    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email)
      throw new UnauthorizedException('INVALID_GOOGLE_TOKEN');

    const user = await this.users.upsertGoogleUser({
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    });

    return this.issueTokens(user.id, user.email);
  }

  async refresh(dto: RefreshDto) {
    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      'dev_refresh_secret_change_me';
    const tokenHash = sha256(`${refreshSecret}.${dto.refreshToken}`);
    const record = await this.users.findRefreshTokenByHash(tokenHash);
    if (!record) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');

    const now = new Date();
    if (record.revokedAt || record.expiresAt <= now)
      throw new UnauthorizedException('REFRESH_TOKEN_EXPIRED');

    await this.users.revokeRefreshToken(record.id);

    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');

    return this.issueTokens(user.id, user.email);
  }

  private async issueTokens(userId: string, email: string) {
    const payload: JwtAccessPayload = { sub: userId, email };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      'dev_refresh_secret_change_me';
    const refreshTtl = Number(
      this.config.get<string>('JWT_REFRESH_TTL_SECONDS') ?? '2592000',
    );
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);

    await this.users.createRefreshToken({
      userId,
      tokenHash: sha256(`${refreshSecret}.${refreshToken}`),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: await this.users.publicProfile(userId),
    };
  }
}
