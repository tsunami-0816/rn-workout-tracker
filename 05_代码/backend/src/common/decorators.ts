import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';

/** JWT 载荷（只放 sub/role/phone，架构 §6.5） */
export interface JwtPayload {
  sub: number;
  role: 'user' | 'admin';
  phone: string;
}

/** 免鉴权标记（send-code / login / version / health / docs） */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 角色标记：@Roles('admin') */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'user' | 'admin'>) => SetMetadata(ROLES_KEY, roles);

/** 取当前登录用户（由 JwtAuthGuard 注入 req.user） */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => ctx.switchToHttp().getRequest().user,
);
