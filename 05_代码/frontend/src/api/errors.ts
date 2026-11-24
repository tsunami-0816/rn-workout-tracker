/** 统一错误与错误码 → 中文文案（架构 §6.2 的 10 个错误码） */

export class AppError extends Error {
  public readonly code: number;
  public readonly httpStatus?: number;
  public readonly field?: string;

  constructor(code: number, message: string, options?: { httpStatus?: number; field?: string }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.field = options?.field;
  }
}

export const ERR_NETWORK = -1;
export const ERR_TIMEOUT = -2;
export const ERR_BAD_RESPONSE = -3;

const MESSAGES: Record<number, string> = {
  40001: '参数校验失败，请检查输入',
  40002: '本次训练已结束',
  40101: '登录已过期，请重新登录',
  40102: '验证码错误或已过期',
  40301: '无权限访问该资源',
  40401: '数据不存在或已被删除',
  42901: '操作太频繁，请稍后再试',
  50001: '服务开小差了，请稍后重试',
  50002: '数据库繁忙，请稍后重试',
  [ERR_NETWORK]: '网络异常，请检查网络后重试',
  [ERR_TIMEOUT]: '请求超时，请稍后重试',
  [ERR_BAD_RESPONSE]: '服务返回格式异常'
};

/** 业务码 → 中文提示；未知码回退服务端 message，再回退通用文案 */
export function friendlyMessage(code: number, serverMessage?: string): string {
  const known = MESSAGES[code];
  if (known) return known;
  if (serverMessage && serverMessage.trim().length > 0) return serverMessage;
  return '请求失败，请稍后重试';
}

/** 把 unknown 归一成可展示文案，不泄露堆栈 */
export function errorText(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return '请求失败，请稍后重试';
}
