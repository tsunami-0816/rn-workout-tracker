import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { findProjectRoot } from '../common/paths';

/**
 * 导出 OpenAPI 契约（C03：端点 ≥18）
 * 用法：npm run build && node dist/tools/export-openapi.js [输出路径]
 * 护栏：paths=0 时报错退出，绝不用空契约覆盖已有文件（SparrowScheduler 事故）
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('RN Workout API')
    .setDescription('rn-mobile-app-release 后端契约（20 端点）')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const pathCount = Object.keys(document.paths ?? {}).length;
  if (pathCount === 0) {
    throw new Error('OpenAPI paths=0，导出地址或装饰器有误，已拒绝覆盖契约文件');
  }

  const outPath = process.argv[2] ?? resolve(findProjectRoot(process.cwd()), '06.5_契约', 'openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  Logger.log(`OpenAPI 已导出：${outPath}（paths=${pathCount}）`, 'ExportOpenApi');
  await app.close();
}

main().catch((err: unknown) => {
  Logger.error(err instanceof Error ? err.message : String(err), '', 'ExportOpenApi');
  process.exitCode = 1;
});
