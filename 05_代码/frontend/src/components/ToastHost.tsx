import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '../store/toastStore';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

/** 顶部浮层提示：只出现在弹层级，2.4s 自动消失；不拦截点击 */
export function ToastHost(): React.JSX.Element {
  const message = useToastStore((state) => state.message);
  const kind = useToastStore((state) => state.kind);
  const seq = useToastStore((state) => state.seq);
  const hide = useToastStore((state) => state.hide);
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true
    }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true
      }).start(() => hide());
    }, 2400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, seq, hide, progress]);

  if (!message) return <></>;

  const background =
    kind === 'error' ? colors.dangerSoft : kind === 'success' ? colors.accentSoft : colors.ink;
  const textColor = kind === 'info' ? '#FFFFFF' : kind === 'error' ? colors.danger : colors.accent;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.xs }]}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: background, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }
        ]}
      >
        <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    maxWidth: 480
  },
  text: { fontSize: fontSize.body, fontWeight: fontWeight.medium }
});
