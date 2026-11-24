import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';

/**
 * 请求追踪中间件：生成 8 位 traceId，落 JSONL 到 logs/requests.jsonl
 * 记录字段 {ts,traceId,method,path,status,ms,userId?}，不记录 token / 验证码
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  private readonly logger = new Logger('TraceMiddleware');
  private readonly logDir = join(process.cwd(), 'logs');
  private readonly logFile = join(this.logDir, 'requests.jsonl');
  private readonly slowThresholdMs = 300;
  private ready = false;

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const traceId = randomBytes(4).toString('hex');
    (req as Request & { traceId: string }).traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
    const started = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - started;
      const userId = (req as Request & { user?: { sub?: number } }).user?.sub;
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        traceId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms,
        ...(userId ? { userId } : {}),
      });
      void this.append(line);
      // 架构 §544 / D-31：>300ms 打 warn，便于第 6/7 步直接定位慢接口
      if (ms > this.slowThresholdMs) {
        this.logger.warn(`慢请求 ${req.method} ${req.originalUrl.split('?')[0]} ${ms}ms（traceId=${traceId}）`);
      }
    });
    next();
  }

  private async append(line: string): Promise<void> {
    try {
      if (!this.ready) {
        await mkdir(this.logDir, { recursive: true });
        this.ready = true;
      }
      await appendFile(this.logFile, `${line}\n`, 'utf8');
    } catch {
      // 日志失败不影响主流程（本地演示环境）
    }
  }
}
