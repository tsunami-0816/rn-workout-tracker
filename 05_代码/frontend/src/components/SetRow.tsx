import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';
import { formatVolume } from '../utils/format';
import { Stepper } from './Stepper';

export type RowStatus = 'idle' | 'pending' | 'saved' | 'error';

export interface DraftRow {
  setNo: number;
  weight: number;
  reps: number;
  done: boolean;
  serverId?: number;
  status: RowStatus;
}

interface SetRowProps {
  row: DraftRow;
  disabled: boolean;
  onWeight: (delta: number) => void;
  onReps: (delta: number) => void;
  onToggle: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

/** 单组录入卡：重量 2.5kg 步进 / 次数 1 步进 / 完成勾选 / 失败红行可重试（D-07） */
export function SetRowCard({
  row,
  disabled,
  onWeight,
  onReps,
  onToggle,
  onRetry,
  onDelete
}: SetRowProps): React.JSX.Element {
  const statusText =
    row.status === 'saved'
      ? '已保存'
      : row.status === 'pending'
        ? '提交中…'
        : row.status === 'error'
          ? '未保存'
          : '待填写';
  const statusColor = row.status === 'error' ? colors.danger : colors.inkMuted;

  return (
    <View style={[styles.setCard, row.status === 'error' && styles.setCardError]}>
      <View style={styles.setTop}>
        <Text style={styles.setNo}>第 {row.setNo} 组</Text>
        <Text style={[styles.setStatus, { color: statusColor }]}>{statusText}</Text>
        <View style={styles.spacer} />
        {row.serverId && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`删除第 ${row.setNo} 组`}
            onPress={onDelete}
            hitSlop={8}
          >
            <Text style={styles.delete}>删除</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>重量 kg</Text>
        <Stepper
          value={formatVolume(row.weight)}
          onDecrease={() => onWeight(-2.5)}
          onIncrease={() => onWeight(2.5)}
          disabled={disabled}
          decrementLabel={`第 ${row.setNo} 组重量减 2.5kg`}
          incrementLabel={`第 ${row.setNo} 组重量加 2.5kg`}
        />
      </View>

      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>次数</Text>
        <Stepper
          value={String(row.reps)}
          onDecrease={() => onReps(-1)}
          onIncrease={() => onReps(1)}
          disabled={disabled}
          decrementLabel={`第 ${row.setNo} 组次数减 1`}
          incrementLabel={`第 ${row.setNo} 组次数加 1`}
        />
      </View>

      {row.status === 'error' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`重试第 ${row.setNo} 组`}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>重试保存</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: row.done, disabled }}
          accessibilityLabel={`第 ${row.setNo} 组完成`}
          onPress={disabled ? undefined : onToggle}
          style={[styles.check, row.done && styles.checkDone, disabled && styles.checkDisabled]}
        >
          <Text style={[styles.checkText, row.done && styles.checkTextDone]}>
            {row.done ? '已完成 · 点击取消' : '完成这组'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  setCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  setCardError: { borderColor: colors.danger },
  setTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  setNo: { color: colors.ink, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  setStatus: { fontSize: fontSize.meta },
  spacer: { flex: 1 },
  delete: { color: colors.inkMuted, fontSize: fontSize.label },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  controlLabel: { color: colors.inkMuted, fontSize: fontSize.label },
  check: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkDone: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  checkDisabled: { opacity: 0.5 },
  checkText: { color: colors.ink, fontSize: fontSize.label, fontWeight: fontWeight.medium },
  checkTextDone: { color: colors.accent, fontWeight: fontWeight.semibold },
  retry: {
    minHeight: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryText: { color: colors.danger, fontSize: fontSize.label, fontWeight: fontWeight.semibold }
});
