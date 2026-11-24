import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from '../theme/tokens';

interface StepperProps {
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}

/** 44px 触控的数值步进；值按 tabular 对齐，避免点一次跳两格 */
export function Stepper({
  value,
  onDecrease,
  onIncrease,
  disabled = false,
  decrementLabel,
  incrementLabel
}: StepperProps): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decrementLabel}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onDecrease}
        style={({ pressed }) => [styles.button, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <View style={styles.valueBox}>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={incrementLabel}
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onIncrease}
        style={({ pressed }) => [styles.button, pressed && !disabled ? styles.pressed : null, disabled ? styles.disabled : null]}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  disabled: { opacity: 0.4 },
  sign: { color: colors.ink, fontSize: 20, fontWeight: fontWeight.medium, lineHeight: 24 },
  valueBox: { minWidth: 52, alignItems: 'center' },
  value: {
    color: colors.ink,
    fontSize: fontSize.heading,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums']
  }
});
