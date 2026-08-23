import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthUser } from '../../common/auth/auth-user';
import { checkRateLimit } from '../../common/rate-limit';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(
    @Req() request: Request,
    @Body() dto: RegisterDto,
  ) {
    checkRateLimit(`register:${request.ip}`, 10, 60_000);
    return this.auth.register(dto);
  }
  @Post('login') login(@Req() request: Request, @Body() dto: LoginDto) {
    checkRateLimit(`login-address:${request.ip}`, 60, 60_000);
    checkRateLimit(`login-account:${dto.email}`, 10, 60_000);
    return this.auth.login(dto);
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
