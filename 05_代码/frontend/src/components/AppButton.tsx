import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 扁平按钮：主操作近黑/深绿填充，次级描边；只有真正浮起的弹层才用阴影 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style
}: AppButtonProps): React.JSX.Element {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : colors.accent} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  pressed: { opacity: 0.82 },
  inactive: { opacity: 0.45 },
  label: { fontSize: fontSize.body, fontWeight: fontWeight.semibold }
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.ink },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerSoft }
};

const labelStyles = {
  primary: { color: '#FFFFFF' },
  secondary: { color: colors.ink },
  ghost: { color: colors.accent },
  danger: { color: colors.danger }
} as const;
