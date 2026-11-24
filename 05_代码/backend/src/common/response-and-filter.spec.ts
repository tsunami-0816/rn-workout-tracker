/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { firstValueFrom, of } from 'rxjs';
import { BadRequestException } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppError } from './app-error';
import { ERR } from './error-codes';

/** 统一响应包装 + 全局异常过滤单测（C03/C12） */
const mfn = (v?: any): any => (v ? (jest as any).fn(v) : (jest as any).fn());

function ctxOf(req: any) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => req.res,
    }),
  } as any;
}

describe('ResponseInterceptor', () => {
  it('业务返回包成 {code:0,message:ok,data,traceId}', async () => {
    const interceptor = new ResponseInterceptor();
    const req = { traceId: 'abcd1234' };
    const wrapped: any = await firstValueFrom(
      interceptor.intercept(ctxOf(req), { handle: () => of({ list: [1, 2] }) } as any) as any,
    );
    expect(wrapped).toEqual({ code: 0, message: 'ok', data: { list: [1, 2] }, traceId: 'abcd1234' });
  });

  it('返回 undefined 时 data 置 null', async () => {
    const interceptor = new ResponseInterceptor();
    const wrapped: any = await firstValueFrom(
      interceptor.intercept(ctxOf({}), { handle: () => of(undefined) } as any) as any,
    );
    expect(wrapped.data).toBeNull();
    expect(wrapped.traceId).toBe('');
  });
});

describe('AllExceptionsFilter', () => {
  function host(req: any, res: any) {
    return {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any;
  }

  it('AppError → 保留业务 code / HTTP 状态 / traceId', () => {
    const json = mfn();
    const res: any = { status: mfn(() => res), json };
    const filter = new AllExceptionsFilter();
    filter.catch(new AppError(ERR.CODE_INVALID), host({ traceId: 't-1' }, res));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      code: ERR.CODE_INVALID,
      message: '验证码错误或已过期',
      data: null,
      traceId: 't-1',
    });
  });

  it('ValidationPipe 400 → 40001 且带 data.field', () => {
    const json = mfn();
    const res: any = { status: mfn(() => res), json };
    const filter = new AllExceptionsFilter();
    filter.catch(
      new BadRequestException({ message: ['phone must be a valid phone'] }),
      host({ traceId: 't-2' }, res),
    );
    expect(res.status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0];
    expect(body.code).toBe(ERR.PARAM_INVALID);
    expect(body.data.field).toBe('phone');
  });

  it('未知异常 → 500 / 50001，不泄露栈', () => {
    const json = mfn();
    const res: any = { status: mfn(() => res), json };
    const filter = new AllExceptionsFilter();
    filter.catch(new Error('boom internal detail'), host({ traceId: 't-3' }, res));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({ code: ERR.INTERNAL, message: '服务内部错误，请稍后重试' });
  });
});
