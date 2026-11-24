/**
 * 统一错误码（架构 §6.2，10 个）
 * 业务成功统一 HTTP 200 + code 0；鉴权 401 / 越权 403 / 未找到 404 / 限流 429
 */
export const ERR = {
  OK: 0,
  PARAM_INVALID: 40001,
  STATE_CONFLICT: 40002,
  UNAUTHORIZED: 40101,
  CODE_INVALID: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CODE_TOO_FREQUENT: 42901,
  INTERNAL: 50001,
  DB_TIMEOUT: 50002,
} as const;

/** code → 默认中文文案（前端 Toast 可直接用） */
export const ERR_MESSAGE: Record<number, string> = {
  [ERR.PARAM_INVALID]: '参数校验失败',
  [ERR.STATE_CONFLICT]: '当前状态不允许该操作',
  [ERR.UNAUTHORIZED]: '登录已过期，请重新登录',
  [ERR.CODE_INVALID]: '验证码错误或已过期',
  [ERR.FORBIDDEN]: '无权限访问该资源',
  [ERR.NOT_FOUND]: '资源不存在',
  [ERR.CODE_TOO_FREQUENT]: '操作过于频繁，请稍后再试',
  [ERR.INTERNAL]: '服务内部错误，请稍后重试',
  [ERR.DB_TIMEOUT]: '数据库繁忙，请重试',
};

/** 错误码 → HTTP 状态 */
export const ERR_HTTP: Record<number, number> = {
  [ERR.PARAM_INVALID]: 400,
  [ERR.STATE_CONFLICT]: 400,
  [ERR.UNAUTHORIZED]: 401,
  [ERR.CODE_INVALID]: 401,
  [ERR.FORBIDDEN]: 403,
  [ERR.NOT_FOUND]: 404,
  [ERR.CODE_TOO_FREQUENT]: 429,
  [ERR.INTERNAL]: 500,
  [ERR.DB_TIMEOUT]: 504,
};
