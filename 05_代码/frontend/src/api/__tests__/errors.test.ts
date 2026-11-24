import { AppError, ERR_NETWORK, ERR_TIMEOUT, errorText, friendlyMessage } from '../errors';

describe('friendlyMessage', () => {
  it('十个业务错误码都有中文文案', () => {
    expect(friendlyMessage(40001)).toContain('参数');
    expect(friendlyMessage(40002)).toBe('本次训练已结束');
    expect(friendlyMessage(40101)).toContain('登录已过期');
    expect(friendlyMessage(40102)).toContain('验证码');
    expect(friendlyMessage(40301)).toBe('无权限访问该资源');
    expect(friendlyMessage(40401)).toContain('不存在');
    expect(friendlyMessage(42901)).toContain('频繁');
    expect(friendlyMessage(50001)).toContain('服务');
    expect(friendlyMessage(50002)).toContain('数据库');
  });

  it('网络与超时', () => {
    expect(friendlyMessage(ERR_NETWORK)).toBe('网络异常，请检查网络后重试');
    expect(friendlyMessage(ERR_TIMEOUT)).toBe('请求超时，请稍后重试');
  });

  it('未知码回退服务端 message', () => {
    expect(friendlyMessage(99999, '服务端自定义')).toBe('服务端自定义');
    expect(friendlyMessage(99999)).toBe('请求失败，请稍后重试');
  });
});

describe('errorText', () => {
  it('AppError 用自身 message', () => {
    expect(errorText(new AppError(40301, '无权限访问该资源'))).toBe('无权限访问该资源');
  });

  it('普通 Error 用 message', () => {
    expect(errorText(new Error('boom'))).toBe('boom');
  });

  it('未知值给兜底文案', () => {
    expect(errorText({ weird: true })).toBe('请求失败，请稍后重试');
  });
});
