/** 客户端纯函数：容量格式化 / ISO 周区间 / 手机号脱敏 / 数值步进约束（D-34 单测对象） */

/** 千分位；最多保留 2 位小数，整数不补 .0 */
export function formatVolume(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  const fixed = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const [intPart = '0', decimalPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart ? `${grouped}.${decimalPart}` : grouped;
}

/** 本地时区 YYYY-MM-DD（不用 toISOString，避免 UTC 偏移把日期挪一天） */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ISO 周：周一为第一天。返回该日期所在周的周一与周日 */
export function isoWeekRange(date: Date): { start: string; end: string } {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = local.getDay(); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(local);
  monday.setDate(local.getDate() + offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
}

/** '2026-11-23' → '11/23'（柱图 x 轴短标签） */
export function shortDate(isoDate: string): string {
  const parts = isoDate.split('-');
  const month = parts[1] ?? '01';
  const day = parts[2] ?? '01';
  return `${month}/${day}`;
}

/** 手机号脱敏：保留前 3 后 4，中间四位星号；非法长度原样返回 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11) return phone;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/** 手机号格式校验：^1[3-9]\d{9}$ */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/** 重量步进：2.5kg 一档，范围 0–500 */
export function stepWeight(current: number, delta: number): number {
  const next = Math.round((current + delta) * 10) / 10;
  return clamp(next, 0, 500);
}

/** 次数步进：1 次一档，范围 1–50（0 次不允许提交） */
export function stepReps(current: number, delta: number): number {
  const next = Math.round(current + delta);
  return clamp(next, 1, 50);
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 组次容量：weight * reps（done 才计入由调用方决定） */
export function setVolume(weight: number, reps: number): number {
  return Math.round(weight * reps * 100) / 100;
}
