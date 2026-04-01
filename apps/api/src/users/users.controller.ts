import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  me(@Request() req: any) {
    return this.users.publicProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('activity')
  activity(@Request() req: any) {
    return this.users.getProfileActivity(req.user.userId);
  }
}
