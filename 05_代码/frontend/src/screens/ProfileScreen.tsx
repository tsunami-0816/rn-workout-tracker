import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorText } from '../api/errors';
import { localBuildNo, localVersion, resolveApiBaseUrl } from '../config';
import { queryClient, queryKeys } from '../queryClient';
import { useAuthStore } from '../store/authStore';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { BrandLine } from '../components/BrandMark';
import { Screen } from '../components/Screen';
import { StateView } from '../components/StateView';
import type { RootNavigation } from '../navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const cachedUser = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const meQuery = useQuery({ queryKey: queryKeys.me, queryFn: api.me });

  const me = meQuery.data;
  const role = me?.role ?? cachedUser?.role;
  const nickname = me?.nickname ?? cachedUser?.nickname ?? '训练者';

  const confirmLogout = (): void => {
    Alert.alert('退出登录', '设备安全区里的 token 会被清除，下次需要重新验证码登录。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOut();
            queryClient.clear();
          })();
        }
      }
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BrandLine subtitle="账号与数据边界" />
        <AppHeader title="我的" subtitle="手机号脱敏展示；管理权限只来自服务端角色" />

        {meQuery.isLoading && !cachedUser ? <StateView mode="loading" message="正在取账号信息…" /> : null}

        {meQuery.isError && !cachedUser ? (
          <StateView
            mode="error"
            message={errorText(meQuery.error)}
            onRetry={() => {
              void meQuery.refetch();
            }}
          />
        ) : null}

        {(me || cachedUser) ? (
          <View style={styles.identity}>
            <View style={styles.identityTop}>
              <View style={styles.avatar} accessibilityLabel="账号头像占位">
                <Text style={styles.avatarText}>{nickname.slice(0, 1)}</Text>
              </View>
              <View style={styles.identityMain}>
                <Text style={styles.nickname} numberOfLines={1}>
                  {nickname}
                </Text>
                <Text style={styles.phone}>{me?.phoneMasked ?? '手机号待刷新'}</Text>
              </View>
              <View style={[styles.rolePill, role === 'admin' ? styles.rolePillAdmin : null]}>
                <Text style={[styles.roleText, role === 'admin' ? styles.roleTextAdmin : null]}>
                  {role === 'admin' ? '管理员' : '普通用户'}
                </Text>
              </View>
            </View>
            <Text style={styles.identityNote}>
              训练记录按登录用户隔离；管理员接口只读全站汇总，不改任何人的数据。
            </Text>
          </View>
        ) : null}

        {meQuery.isError && cachedUser ? (
          <Text style={styles.warnLine}>账号信息刷新失败：{errorText(meQuery.error)}（显示的是本地缓存）</Text>
        ) : null}

        <View style={styles.menu}>
          <MenuRow label="登录凭据" value="SecureStore（不可用时降级 AsyncStorage）" />
          <MenuRow label="服务地址" value={resolveApiBaseUrl().replace(/^http:\/\//, '')} />
          <MenuRow label="当前版本" value={`v${localVersion()} · build ${localBuildNo()}`} />
        </View>

        {role === 'admin' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="进入管理后台"
            onPress={() => navigation.navigate('Admin')}
            style={({ pressed }) => [styles.adminEntry, pressed && styles.pressed]}
          >
            <View style={styles.adminMain}>
              <Text style={styles.adminTitle}>管理后台</Text>
              <Text style={styles.adminSub}>全站打卡 · 管理员可见 · 手机号已脱敏 · 只读</Text>
            </View>
            <Text style={styles.adminAction}>进入</Text>
          </Pressable>
        ) : (
          <Text style={styles.memberNote}>普通用户没有管理后台入口；即使手改路由，服务端也会返回 403。</Text>
        )}

        <View style={styles.footer}>
          <AppButton label="退出登录" variant="danger" onPress={confirmLogout} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function MenuRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.menuRow}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  identity: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: colors.accent, fontSize: fontSize.heading, fontWeight: fontWeight.bold },
  identityMain: { flex: 1, gap: 2 },
  nickname: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.semibold },
  phone: { color: colors.inkMuted, fontSize: fontSize.label, fontVariant: ['tabular-nums'] },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt
  },
  rolePillAdmin: { backgroundColor: colors.accentSoft },
  roleText: { color: colors.inkMuted, fontSize: fontSize.meta, fontWeight: fontWeight.medium },
  roleTextAdmin: { color: colors.accent, fontWeight: fontWeight.semibold },
  identityNote: { color: colors.inkMuted, fontSize: fontSize.meta, lineHeight: 18 },
  warnLine: { color: colors.danger, fontSize: fontSize.meta, lineHeight: 18 },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52
  },
  menuLabel: { color: colors.inkMuted, fontSize: fontSize.label, width: 72 },
  menuValue: { flex: 1, color: colors.ink, fontSize: fontSize.label, textAlign: 'right' },
  adminEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    marginTop: spacing.sm,
    minHeight: 64
  },
  pressed: { opacity: 0.86 },
  adminMain: { flex: 1, gap: 2 },
  adminTitle: { color: colors.accent, fontSize: fontSize.body, fontWeight: fontWeight.semibold },
  adminSub: { color: colors.inkMuted, fontSize: fontSize.meta },
  adminAction: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  memberNote: { color: colors.inkFaint, fontSize: fontSize.meta, lineHeight: 18, marginTop: spacing.sm },
  footer: { marginTop: spacing.lg }
});
