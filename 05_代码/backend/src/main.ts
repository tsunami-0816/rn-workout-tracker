import { Logger, ValidationPipe, ValidationError } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AppError } from './common/app-error';
import { ERR } from './common/error-codes';
import { findProjectRoot } from './common/paths';
import { TraceMiddleware } from './common/trace.middleware';

/** 校验错误 → 40001 + data.field（前端字段红字） */
function validationExceptionFactory(errors: ValidationError[]): AppError {
  const first = errors[0];
  const constraint = first?.constraints ? Object.values(first.constraints)[0] : '参数不合法';
  return new AppError(ERR.PARAM_INVALID, String(constraint), { field: first?.property ?? 'body' });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api');
  // APK 静态托管：release.json 的 apkUrl 指向 /apk/<文件名>，真机更新弹窗可直接下载
  app.useStaticAssets(join(findProjectRoot(), '10_交付', 'apk'), { prefix: '/apk/' });
  // traceId / JSONL 请求日志：最先执行，覆盖所有 /api 路由
  const trace = app.get(TraceMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) => {
    void trace.use(req, res, next);
  });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // CORS：dev 放开 localhost/127.0.0.1 任意端口（Flutter Chrome 端口随机）
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Trace-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('RN Workout API')
      .setDescription('rn-mobile-app-release 后端契约（20 端点）')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? 8094);
  await app.listen(port, '0.0.0.0');
  Logger.log(`后端已启动：http://127.0.0.1:${port}/api/health`, 'Bootstrap');
}

void bootstrap();
