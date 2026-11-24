/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TraceMiddleware } from './trace.middleware';

/** TraceMiddleware 单测：8 位 traceId + X-Trace-Id 头 + JSONL 落盘（C12 的 P95 数据来源） */

function fakeRes() {
  const emitter = new EventEmitter() as any;
  emitter.setHeader = jest.fn();
  emitter.statusCode = 200;
  return emitter;
}

describe('TraceMiddleware', () => {
  it('设置 8 位 traceId 与 X-Trace-Id 响应头，并调用 next', async () => {
    const mw = new TraceMiddleware();
    const req: any = { method: 'GET', originalUrl: '/api/plans?page=1', headers: {} };
    const res = fakeRes();
    let nexted = false;
    await mw.use(req, res, () => {
      nexted = true;
    });
    expect(req.traceId).toMatch(/^[0-9a-f]{8}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-Id', req.traceId);
    expect(nexted).toBe(true);
  });

  it('响应结束后 JSONL 追加一行（含 traceId/path/status/ms）', async () => {
    const mw = new TraceMiddleware();
    const req: any = { method: 'POST', originalUrl: '/api/workouts/start?x=1', headers: {}, user: { sub: 2 } };
    const res = fakeRes();
    await mw.use(req, res, () => undefined);
    res.emit('finish');
    await new Promise((r) => setTimeout(r, 80));
    const file = join(process.cwd(), 'logs', 'requests.jsonl');
    expect(existsSync(file)).toBe(true);
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.traceId).toBe(req.traceId);
    expect(last.path).toBe('/api/workouts/start');
    expect(last.method).toBe('POST');
    expect(last.userId).toBe(2);
  });

  it('>300ms 打 warn（D-31 / F-06）', async () => {
    const mw = new TraceMiddleware();
    const warnSpy = jest.spyOn((mw as any).logger, 'warn').mockImplementation(() => undefined);
    const t0 = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValueOnce(t0).mockReturnValueOnce(t0 + 350);
    const req: any = { method: 'GET', originalUrl: '/api/stats/weekly', headers: {} };
    const res = fakeRes();
    await mw.use(req, res, () => undefined);
    res.emit('finish');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('350ms');
    nowSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('≤300ms 不打 warn', async () => {
    const mw = new TraceMiddleware();
    const warnSpy = jest.spyOn((mw as any).logger, 'warn').mockImplementation(() => undefined);
    const t0 = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValueOnce(t0).mockReturnValueOnce(t0 + 120);
    const req: any = { method: 'GET', originalUrl: '/api/health', headers: {} };
    const res = fakeRes();
    await mw.use(req, res, () => undefined);
    res.emit('finish');
    expect(warnSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
