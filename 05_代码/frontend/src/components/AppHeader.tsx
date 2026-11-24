import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing, touchTarget } from '../theme/tokens';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

/** 页面标题：18–22px，左对齐；返回是文字动作，不做图标堆叠（app-screens §12） */
export function AppHeader({ title, subtitle, onBack, right }: AppHeaderProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回"
            onPress={onBack}
            style={styles.back}
            hitSlop={8}
          >
            <Text style={styles.backText}>返回</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget },
  back: { justifyContent: 'center', minHeight: touchTarget },
  backText: { color: colors.accent, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2
  },
  right: { alignItems: 'flex-end' },
  subtitle: {
    marginTop: spacing.xxs,
    color: colors.inkMuted,
    fontSize: fontSize.label,
    lineHeight: 18
  }
});
