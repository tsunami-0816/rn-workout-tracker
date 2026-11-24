import { HttpException } from '@nestjs/common';
import { ERR_HTTP, ERR_MESSAGE } from './error-codes';

/**
 * 业务异常：携带五位错误码，由 AllExceptionsFilter 统一转成 {code,message,data,traceId}
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: number,
    message?: string,
    public readonly bizData?: unknown,
  ) {
    super(
      { code, message: message ?? ERR_MESSAGE[code] ?? '请求失败', data: bizData ?? null },
      ERR_HTTP[code] ?? 500,
    );
  }
}
