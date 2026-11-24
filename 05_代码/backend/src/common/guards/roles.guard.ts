import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppError } from '../app-error';
import { ERR } from '../error-codes';
import { JwtPayload, ROLES_KEY } from '../decorators';

/**
 * 角色守卫：@Roles('admin') 命中后校验 JWT role
 * 已登录但角色不够 = 40301（不清登录态）；没登录 = 40101
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Array<'user' | 'admin'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!req.user) throw new AppError(ERR.UNAUTHORIZED);
    if (!roles.includes(req.user.role)) throw new AppError(ERR.FORBIDDEN);
    return true;
  }
}
