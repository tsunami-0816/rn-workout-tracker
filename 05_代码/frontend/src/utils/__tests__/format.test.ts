import {
  formatVolume,
  isoWeekRange,
  isValidPhone,
  maskPhone,
  setRowActionLabel,
  setVolume,
  shortDate,
  stepReps,
  stepWeight
} from '../format';

describe('formatVolume', () => {
  it('整数带千分位', () => {
    expect(formatVolume(1200)).toBe('1,200');
    expect(formatVolume(0)).toBe('0');
  });

  it('小数最多两位且去掉末尾 0', () => {
    expect(formatVolume(42.5)).toBe('42.5');
    expect(formatVolume(1200.25)).toBe('1,200.25');
    expect(formatVolume(40)).toBe('40');
  });

  it('非法值回落 0', () => {
    expect(formatVolume(Number.NaN)).toBe('0');
    expect(formatVolume(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('isoWeekRange', () => {
  it('周一是本周起点', () => {
    expect(isoWeekRange(new Date(2026, 10, 23))).toEqual({ start: '2026-11-23', end: '2026-11-29' });
  });

  it('周日仍属于本周（周一–周日）', () => {
    expect(isoWeekRange(new Date(2026, 10, 29))).toEqual({ start: '2026-11-23', end: '2026-11-29' });
  });

  it('跨月边界', () => {
    expect(isoWeekRange(new Date(2026, 11, 1))).toEqual({ start: '2026-11-30', end: '2026-12-06' });
  });
});

describe('maskPhone / isValidPhone', () => {
  it('11 位手机号脱敏', () => {
    expect(maskPhone('13900139000')).toBe('139****9000');
  });

  it('非 11 位原样返回', () => {
    expect(maskPhone('12345')).toBe('12345');
  });

  it('手机号格式校验', () => {
    expect(isValidPhone('13900139000')).toBe(true);
    expect(isValidPhone('12900139000')).toBe(false);
    expect(isValidPhone('1390013900')).toBe(false);
  });
});

describe('步进约束与容量', () => {
  it('重量 2.5 步进并在 0–500 内', () => {
    expect(stepWeight(20, 2.5)).toBe(22.5);
    expect(stepWeight(0, -2.5)).toBe(0);
    expect(stepWeight(500, 2.5)).toBe(500);
  });

  it('次数 1 步进并在 1–50 内', () => {
    expect(stepReps(10, 1)).toBe(11);
    expect(stepReps(1, -1)).toBe(1);
    expect(stepReps(50, 1)).toBe(50);
  });

  it('容量 = 重量 × 次数', () => {
    expect(setVolume(42.5, 10)).toBe(425);
    expect(setVolume(0, 10)).toBe(0);
  });
});

describe('shortDate', () => {
  it('输出 MM/DD', () => {
    expect(shortDate('2026-11-23')).toBe('11/23');
  });
});

describe('setRowActionLabel（Q-009 回归）', () => {
  it('训练中：未完成提示完成、已完成提示可取消', () => {
    expect(setRowActionLabel(false, false)).toBe('完成这组');
    expect(setRowActionLabel(true, false)).toBe('已完成 · 点击取消');
  });

  it('训练结束后：不再出现「点击取消」字样', () => {
    expect(setRowActionLabel(true, true)).toBe('已完成（已锁定）');
    expect(setRowActionLabel(false, true)).toBe('未完成（已锁定）');
  });

  it('锁定文案不含可操作暗示', () => {
    expect(setRowActionLabel(true, true)).not.toContain('取消');
  });
});
