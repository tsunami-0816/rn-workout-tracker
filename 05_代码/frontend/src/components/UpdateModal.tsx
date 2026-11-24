import React from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import type { VersionData } from '../api/types';
import { showToast } from '../store/toastStore';
import { AppButton } from './AppButton';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

interface UpdateModalProps {
  version: VersionData | null;
  onDismiss: () => void;
}

/** 新版本弹窗：只做两件事——说清是哪个版本、能不能打开下载地址 */
export function UpdateModal({ version, onDismiss }: UpdateModalProps): React.JSX.Element {
  const openDownload = (): void => {
    if (!version) return;
    Linking.openURL(version.apkUrl).catch(() => {
      showToast('无法打开下载地址，请检查 apkUrl 是否可达', 'error');
    });
  };

  return (
    <Modal
      visible={version !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>发现新版本 {version?.version ?? ''}</Text>
          <Text style={styles.meta}>构建号 {version?.buildNo ?? ''} · 当前版本已落后</Text>
          {version?.notes ? <Text style={styles.notes}>{version.notes}</Text> : null}
          <Text style={styles.note}>
            覆盖安装会保留同包名的登录态；下载地址由 release.json 的 apkUrl 提供。
          </Text>
          <AppButton label="去下载" onPress={openDownload} style={styles.primary} />
          <AppButton label="稍后" variant="ghost" onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 23, 26, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs
  },
  title: { color: colors.ink, fontSize: fontSize.title, fontWeight: fontWeight.semibold },
  meta: { color: colors.inkMuted, fontSize: fontSize.label },
  notes: { color: colors.ink, fontSize: fontSize.body, lineHeight: 22, marginTop: spacing.xs },
  note: { color: colors.inkMuted, fontSize: fontSize.meta, lineHeight: 18, marginTop: spacing.xs },
  primary: { marginTop: spacing.md }
});
