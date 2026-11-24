import { resolveApiBaseUrl } from '../config';
import { authStorage } from '../storage/authStorage';
import { useAuthStore } from '../store/authStore';
import { showToast } from '../store/toastStore';
import { AppError, ERR_BAD_RESPONSE, ERR_NETWORK, ERR_TIMEOUT, friendlyMessage } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ApiEnvelope {
  code: number;
  message: string;
  data: unknown;
  traceId?: string;
}

const BASE_URL = resolveApiBaseUrl();
const TIMEOUT_MS = 8000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelope(value: unknown): value is ApiEnvelope {
  return (
    isRecord(value) &&
    typeof value.code === 'number' &&
    typeof value.message === 'string' &&
    'data' in value
  );
}

function extractField(data: unknown): string | undefined {
  if (isRecord(data) && typeof data.field === 'string') return data.field;
  return undefined;
}

function handleUnauthorized(): void {
  useAuthStore.getState().clearSession();
  showToast('登录已过期，请重新登录', 'error');
}

function toNetworkError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new AppError(ERR_TIMEOUT, friendlyMessage(ERR_TIMEOUT));
  }
  return new AppError(ERR_NETWORK, friendlyMessage(ERR_NETWORK));
}

async function fetchOnce(
  method: HttpMethod,
  path: string,
  body: unknown,
  token: string | null
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseEnvelope(response: Response): Promise<ApiEnvelope> {
  const text = await response.text();
  if (text.trim().length === 0) throw new AppError(ERR_BAD_RESPONSE, friendlyMessage(ERR_BAD_RESPONSE));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(ERR_BAD_RESPONSE, friendlyMessage(ERR_BAD_RESPONSE), {
      httpStatus: response.status
    });
  }
  if (!isEnvelope(parsed)) {
    throw new AppError(ERR_BAD_RESPONSE, friendlyMessage(ERR_BAD_RESPONSE), {
      httpStatus: response.status
    });
  }
  return parsed;
}

/**
 * 唯一请求出口（D-03）：
 * - 8s 超时；GET 网络失败重试 1 次（日志可数）
 * - Token 注入；只有 40101（登录态失效）清态，40102（验证码错）只抛业务错误
 * - 业务码统一转中文
 */
export async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const token = useAuthStore.getState().token ?? (await authStorage.getToken());
  let attempt = 0;

  for (;;) {
    try {
      const response = await fetchOnce(method, path, body, token);
      const envelope = await parseEnvelope(response);

      // F-05：登录端点把「验证码错误」也映射成 HTTP 401，不能见 401 就清态弹「登录已过期」
      if (envelope.code === 40101) {
        handleUnauthorized();
      }
      if (envelope.code !== 0) {
        throw new AppError(envelope.code, friendlyMessage(envelope.code, envelope.message), {
          httpStatus: response.status,
          field: extractField(envelope.data)
        });
      }
      return envelope.data as T;
    } catch (error) {
      const normalized = toNetworkError(error);
      const retriable =
        method === 'GET' &&
        attempt === 0 &&
        (normalized.code === ERR_NETWORK || normalized.code === ERR_TIMEOUT);
      if (retriable) {
        attempt += 1;
        console.info(`[api] GET ${path} 失败（${normalized.code}），重试 1/1`);
        continue;
      }
      throw normalized;
    }
  }
}
