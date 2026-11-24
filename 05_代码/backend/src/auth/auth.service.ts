import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../common/app-error';
import { ERR } from '../common/error-codes';
import { JwtPayload } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** 手机号脱敏：13800138000 → 138****8000（C05/接口脱敏口径） */
export function maskPhone(phone: string): string {
  if (phone.length !== 11) return '***';
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

/** '7d' / '604800' → 秒数（JWT expiresIn 与出参对齐用） */
function parseExpiresIn(raw: string): number {
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = /^(\d+)([smhd])$/.exec(raw);
  if (!m) return 604800;
  const n = Number(m[1]);
  const unit = m[2];
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return n * factor;
}

/**
 * 认证服务：验证码频控 + 登录签发 JWT + 当前用户
 * 验证码只从 DEMO_CODE 读（代码里不含 123456 字面量），缺失由启动校验拦住
 */
@Injectable()
export class AuthService {
  private readonly sentAt = new Map<string, number>();
  private readonly cooldownMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.cooldownMs = Number(config.get('SEND_CODE_COOLDOWN_SEC') ?? 60) * 1000;
  }

  /** 发送验证码：60s 内重复 → 42901（进程内 Map，重启即重置） */
  sendCode(phone: string): { cooldown: number } {
    const now = Date.now();
    const last = this.sentAt.get(phone);
    if (last && now - last < this.cooldownMs) {
      throw new AppError(ERR.CODE_TOO_FREQUENT, undefined, {
        remainSec: Math.ceil((this.cooldownMs - (now - last)) / 1000),
      });
    }
    this.sentAt.set(phone, now);
    return { cooldown: Math.round(this.cooldownMs / 1000) };
  }

  /** 登录：验证码校验 → 不存在则建 role=user（绝不建 admin） */
  async login(phone: string, code: string): Promise<{
    token: string;
    expiresIn: number;
    user: { id: number; nickname: string; role: 'user' | 'admin' };
  }> {
    const expected = this.config.get<string>('DEMO_CODE');
    if (!expected) throw new AppError(ERR.INTERNAL, 'DEMO_CODE 未配置');
    if (code !== expected) throw new AppError(ERR.CODE_INVALID);

    const user =
      (await this.prisma.user.findUnique({ where: { phone } })) ??
      (await this.prisma.user.create({ data: { phone, role: 'user' } }));

    const payload: JwtPayload = {
      sub: Number(user.id),
      role: user.role === 'admin' ? 'admin' : 'user',
      phone: user.phone,
    };
    const expiresIn = parseExpiresIn(this.config.get<string>('JWT_EXPIRES_IN') ?? '7d');
    const token = await this.jwt.signAsync(payload, { expiresIn });
    return { token, expiresIn, user: { id: Number(user.id), nickname: user.nickname, role: payload.role } };
  }

  /** 当前用户（脱敏） */
  async me(userId: number): Promise<{
    id: number;
    nickname: string;
    phoneMasked: string;
    role: 'user' | 'admin';
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new AppError(ERR.NOT_FOUND, '用户不存在');
    return {
      id: Number(user.id),
      nickname: user.nickname,
      phoneMasked: maskPhone(user.phone),
      role: user.role === 'admin' ? 'admin' : 'user',
    };
  }
}
