import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERR, ERR_MESSAGE } from './error-codes';

interface ErrorBody {
  code: number;
  message: string;
  data: unknown;
  traceId: string;
}

/**
 * 全局异常过滤：把 AppError / 校验错误 / 未知异常统一成 §6.1 结构
 * 40001 带 data.field（前端字段红字用）
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { traceId?: string }>();
    const traceId = req.traceId ?? '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody = { code: ERR.INTERNAL, message: ERR_MESSAGE[ERR.INTERNAL], data: null, traceId };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'code' in payload) {
        const p = payload as { code: number; message?: string; data?: unknown };
        body = { code: p.code, message: p.message ?? ERR_MESSAGE[p.code], data: p.data ?? null, traceId };
      } else if (status === HttpStatus.BAD_REQUEST) {
        // ValidationPipe 的错误：message 是 string[]，取首条并抽出字段名
        const messages = Array.isArray((payload as { message?: unknown }).message)
          ? ((payload as { message: string[] }).message)
          : ['参数校验失败'];
        body = {
          code: ERR.PARAM_INVALID,
          message: messages[0] ?? ERR_MESSAGE[ERR.PARAM_INVALID],
          data: { field: this.extractField(messages[0] ?? '') },
          traceId,
        };
      } else {
        body = { code: this.mapHttpToCode(status), message: exception.message, data: null, traceId };
      }
    } else {
      this.logger.error(`未知异常 traceId=${traceId}`, exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status === HttpStatus.BAD_REQUEST || status < 500 ? status : status).json(body);
  }

  /** 从 "phone must be a valid phone" 抽出字段名 */
  private extractField(message: string): string {
    const first = message.split(' ')[0];
    return first && /^[a-zA-Z]/.test(first) ? first : 'body';
  }

  /** 非业务 HttpException 的 HTTP → 五位码兜底 */
  private mapHttpToCode(status: number): number {
    if (status === HttpStatus.UNAUTHORIZED) return ERR.UNAUTHORIZED;
    if (status === HttpStatus.FORBIDDEN) return ERR.FORBIDDEN;
    if (status === HttpStatus.NOT_FOUND) return ERR.NOT_FOUND;
    if (status === HttpStatus.GATEWAY_TIMEOUT) return ERR.DB_TIMEOUT;
    return ERR.INTERNAL;
  }
}
