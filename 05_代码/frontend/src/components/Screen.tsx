import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  /** 页面底部是否留出 TabBar 空间 */
  withTabInset?: boolean;
  style?: ViewStyle;
}

/** 统一地面色、左右 20px、安全区；375/414 两档都不横向溢出（D-15） */
export function Screen({ children, withTabInset = false, style }: ScreenProps): React.JSX.Element {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={[styles.body, withTabInset && styles.tabInset, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm
  },
  tabInset: { paddingBottom: spacing.xxl }
});
