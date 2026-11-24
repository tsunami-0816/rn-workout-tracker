import { request } from '../client';
import { useAuthStore } from '../../store/authStore';
import { showToast } from '../../store/toastStore';
import { ERR_NETWORK, ERR_TIMEOUT } from '../errors';

jest.mock('../../storage/authStorage', () => ({
  authStorage: {
    getToken: jest.fn(async () => null),
    setToken: jest.fn(async () => undefined),
    getUser: jest.fn(async () => null),
    setUser: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined)
  }
}));

jest.mock('../../store/toastStore', () => ({
  showToast: jest.fn()
}));

const mockedToast = showToast as unknown as jest.Mock;

function envelope(body: unknown, status = 200): Response {
  return {
    status,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

describe('api/client（D-03 / F-05 / F-08）', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ token: 'valid-token', user: null, hydrated: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('40102 验证码错误不清登录态、不弹「登录已过期」', async () => {
    global.fetch = jest.fn(async () =>
      envelope({ code: 40102, message: '验证码错误或已过期', data: null }, 401)
    ) as unknown as typeof fetch;

    await expect(request('POST', '/auth/login', { phone: '1', code: 'bad' })).rejects.toMatchObject({
      code: 40102
    });
    expect(useAuthStore.getState().token).toBe('valid-token');
    expect(mockedToast).not.toHaveBeenCalledWith('登录已过期，请重新登录', expect.anything());
  });

  it('40101 清登录态并提示重新登录', async () => {
    global.fetch = jest.fn(async () =>
      envelope({ code: 40101, message: '未登录', data: null }, 401)
    ) as unknown as typeof fetch;

    await expect(request('GET', '/plans')).rejects.toMatchObject({ code: 40101 });
    expect(useAuthStore.getState().token).toBeNull();
    expect(mockedToast).toHaveBeenCalledWith('登录已过期，请重新登录', 'error');
  });

  it('8s 超时：GET 重试 1 次后抛 ERR_TIMEOUT', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    ) as unknown as typeof fetch;

    const pending = request('GET', '/plans').catch((error) => error);
    // 第一次超时 → 重试 → 第二次超时
    await jest.advanceTimersByTimeAsync(8000);
    await jest.advanceTimersByTimeAsync(8000);
    const error = await pending;
    expect(error).toMatchObject({ code: ERR_TIMEOUT });
    expect((global.fetch as unknown as jest.Mock).mock.calls.length).toBe(2);
  });

  it('GET 网络失败重试 1 次后成功；POST 不重试', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(envelope({ code: 0, message: 'ok', data: { list: [] } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(request('GET', '/plans')).resolves.toEqual({ list: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(envelope({ code: 0, message: 'ok', data: {} }));
    await expect(request('POST', '/workouts/start', { planId: 1 })).rejects.toMatchObject({
      code: ERR_NETWORK
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
