import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface Wrapped<T> {
  code: number;
  message: string;
  data: T | null;
  traceId: string;
}

/**
 * 统一返回包装：{code:0,message:'ok',data,traceId}
 * 业务异常不走这里（由 AllExceptionsFilter 处理）
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Wrapped<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Wrapped<T>> {
    const req = context.switchToHttp().getRequest<{ traceId?: string }>();
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'ok',
        data: data ?? null,
        traceId: req.traceId ?? '',
      })),
    );
  }
}
