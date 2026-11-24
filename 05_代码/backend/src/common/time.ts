/** 时区与 ISO 周工具（口径：Asia/Shanghai，周一为一周起点 · 架构 §5.4） */

/** 取上海时区的日期字符串 YYYY-MM-DD（不依赖进程 TZ） */
export function shanghaiDateString(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}

/** 上海时区的 ISO 星期（1=周一 … 7=周日） */
export function isoWeekday(date: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(date);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[name] ?? 1;
}

/** 给定 YYYY-MM-DD，返回本周一（ISO 周）的 YYYY-MM-DD */
export function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const offset = (d.getUTCDay() + 6) % 7; // 周一=0
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → Prisma @db.Date 入参（UTC 零点） */
export function toPrismaDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** 在 YYYY-MM-DD 上加减天数，全程 UTC 运算，避免进程时区影响 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 周起点列表：含本周在内的最近 n 周（升序） */
export function recentWeekStarts(n: number, base: string = shanghaiDateString()): string[] {
  const start = isoWeekStart(base);
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(`${start}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    list.push(d.toISOString().slice(0, 10));
  }
  return list;
}
