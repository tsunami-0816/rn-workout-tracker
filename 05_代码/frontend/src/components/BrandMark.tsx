import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing } from '../theme/tokens';

/** 产品标记：三根等距短线（杠铃片的抽象），只用强调色，不做黑底字母块 */
export function BrandMark(): React.JSX.Element {
  return (
    <View style={styles.mark} accessibilityLabel="训练台账标记">
      <View style={[styles.bar, { width: 20 }]} />
      <View style={[styles.bar, { width: 12 }]} />
      <View style={[styles.bar, { width: 20 }]} />
    </View>
  );
}

export function BrandLine({ subtitle }: { subtitle?: string }): React.JSX.Element {
  return (
    <View style={styles.line}>
      <BrandMark />
      <View>
        <Text style={styles.name}>训练台账</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  mark: { gap: 4, alignSelf: 'center' },
  bar: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  name: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.bold, letterSpacing: -0.2 },
  subtitle: { color: colors.inkMuted, fontSize: fontSize.label, marginTop: 2 }
});
