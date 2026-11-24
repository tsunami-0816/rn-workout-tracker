import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { resolve } from 'node:path';

import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CacheModule } from './common/cache.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/response.interceptor';
import { TraceMiddleware } from './common/trace.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlanModule } from './plans/plan.module';
import { WorkoutModule } from './workouts/workout.module';
import { StatsModule } from './stats/stats.module';
import { AdminModule } from './admin/admin.module';
import { AppInfoModule } from './app-info/app-info.module';

/**
 * 启动期环境校验：JWT_SECRET / DEMO_CODE / DATABASE_URL 缺失直接失败
 * DEMO_CODE 无默认值（T-205：代码里搜不到 123456）
 */
function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['JWT_SECRET', 'DEMO_CODE', 'DATABASE_URL'];
  const missing = required.filter((key) => {
    const value = config[key];
    return value === undefined || String(value).trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(`缺少必填环境变量：${missing.join(', ')}（复制 .env.example 为 .env 后填写）`);
  }
  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '.env'),
      validate: validateEnv,
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // jsonwebtoken 的 StringValue 类型不接受普通 string，运行期接受 '7d'
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as unknown as number,
        },
      }),
    }),
    PrismaModule,
    CacheModule,
    AuthModule,
    PlanModule,
    WorkoutModule,
    StatsModule,
    AdminModule,
    AppInfoModule,
  ],
  providers: [
    // 守卫顺序固定：先认证再判角色
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    TraceMiddleware,
  ],
})
export class AppModule {}
