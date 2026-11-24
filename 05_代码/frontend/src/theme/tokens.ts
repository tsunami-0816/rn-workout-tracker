/**
 * 设计 token：一个地面色 + 一个墨色 + 一个强调色；数据用强色，界面用中性。
 * 间距全部是 8 的倍数（4 仅用于行内微调），与基线 C01 / D-15 对齐。
 */
export const colors = {
  /** 页面地面：偏暖的中性，不用纯白铺满屏幕 */
  ground: '#F4F5F2',
  /** 卡片/面板表面，与地面只差一个色阶 */
  surface: '#FFFFFF',
  /** 次级表面：分区块、输入框 */
  surfaceAlt: '#EDEFEA',
  /** 正文墨色 */
  ink: '#14171A',
  /** 次级文字，4.5:1 以上 */
  inkMuted: '#5A6068',
  /** 极弱文字：脚注、单位（仍保持 ≥4.5:1，不用浅灰糊过去） */
  inkFaint: '#6B7278',
  /** 1px 分隔线，不叠加阴影 */
  border: '#DEE2DA',
  /** 唯一强调色：深松绿（数据、今日标记、主操作） */
  accent: '#1D6B58',
  /** 强调色浅底：状态徽标、今日卡片 */
  accentSoft: '#E2EFEB',
  /** 危险/错误 */
  danger: '#B42318',
  dangerSoft: '#FBEAE8',
  /** 成功 */
  success: '#1D6B58'
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999
} as const;

export const fontSize = {
  display: 32,
  title: 22,
  heading: 18,
  body: 15,
  label: 13,
  meta: 12
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700'
} as const;

/** 触控目标最小高度（app-screens §12 要求 44） */
export const touchTarget = 44;
