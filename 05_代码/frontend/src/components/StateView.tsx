import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

interface StateViewProps {
  mode: 'loading' | 'empty' | 'error';
  message?: string;
  onRetry?: () => void;
  /** empty 态的补充一句（这屏为空时用户该做什么） */
  hint?: string;
}

/** 请求状态机 idle/loading/error/empty 的展示层（D-14） */
export function StateView({ mode, message, onRetry, hint }: StateViewProps): React.JSX.Element {
  if (mode === 'loading') {
    return (
      <View style={styles.frame}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.message}>{message ?? '加载中…'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <Text style={styles.title}>{mode === 'error' ? '没加载出来' : '这里还没有数据'}</Text>
      <Text style={styles.message}>{message ?? (mode === 'error' ? '请检查网络后重试' : '完成一次训练后就会出现内容')}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {mode === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重试"
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
    gap: spacing.xs
  },
  title: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.semibold },
  message: { color: colors.inkMuted, fontSize: fontSize.body, lineHeight: 22 },
  hint: { color: colors.inkMuted, fontSize: fontSize.label },
  retry: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm
  },
  retryText: { color: colors.accent, fontSize: fontSize.body, fontWeight: fontWeight.semibold }
});
