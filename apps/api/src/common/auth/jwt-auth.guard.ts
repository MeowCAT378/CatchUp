import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../app-error';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from './auth-user';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: AuthUser }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');
    try {
      const payload = this.jwt.verify<AuthUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isDisabled: true },
      });
      if (!user) throw new UnauthorizedException('Invalid or expired token');
      if (user.isDisabled)
        throw new AppError('ACCOUNT_DISABLED', 403, 'Account is disabled');
      request.user = { sub: user.id, email: user.email, role: user.role };
      return true;
    } catch (error) {
      if (error instanceof AppError || error instanceof UnauthorizedException)
        throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
