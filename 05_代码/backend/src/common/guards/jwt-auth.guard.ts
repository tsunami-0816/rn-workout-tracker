import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppError } from '../app-error';
import { ERR } from '../error-codes';
import { IS_PUBLIC_KEY, JwtPayload } from '../decorators';

/**
 * 全局 JWT 守卫：默认所有接口要 token，@Public() 豁免
 * 失败统一 40101（前端清 SecureStore → 跳登录），不泄露内部原因
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) throw new AppError(ERR.UNAUTHORIZED);

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { sub: Number(payload.sub), role: payload.role, phone: payload.phone };
      return true;
    } catch {
      throw new AppError(ERR.UNAUTHORIZED);
    }
  }
}
