import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { AppError, errorText } from '../api/errors';
import type { AdminWorkoutItem } from '../api/types';
import { queryKeys } from '../queryClient';
import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { StateView } from '../components/StateView';
import type { RootNavigation } from '../navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';
import { formatVolume } from '../utils/format';

const PAGE_SIZE = 10;

export function AdminScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery({ queryKey: queryKeys.adminSummary, queryFn: api.adminSummary });
  const workoutsQuery = useQuery({
    queryKey: queryKeys.adminWorkouts(page),
    queryFn: () => api.adminWorkouts(page, PAGE_SIZE)
  });
  const usersQuery = useQuery({ queryKey: queryKeys.adminUsers, queryFn: () => api.adminUsers(1, 20) });

  const forbidden =
    (workoutsQuery.error instanceof AppError && workoutsQuery.error.code === 40301) ||
    (summaryQuery.error instanceof AppError && summaryQuery.error.code === 40301);

  if (forbidden) {
    return (
      <Screen>
        <AppHeader title="全站打卡" onBack={() => navigation.goBack()} />
        <StateView
          mode="error"
          message="无权限访问该资源（40301）"
          hint="这个入口只对 role=admin 开放；返回我的页即可。"
          onRetry={() => {
            void summaryQuery.refetch();
            void workoutsQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  const workoutTotal = workoutsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(workoutTotal / PAGE_SIZE));

  return (
    <Screen>
      <AppHeader
        title="全站打卡"
        subtitle="只读视图 · 手机号已脱敏 · 分页上限 50"
        onBack={() => navigation.goBack()}
      />

      {summaryQuery.isLoading ? <StateView mode="loading" message="正在取全站汇总…" /> : null}
      {summaryQuery.isError ? (
        <StateView
          mode="error"
          message={errorText(summaryQuery.error)}
          onRetry={() => {
            void summaryQuery.refetch();
          }}
        />
      ) : null}

      {summaryQuery.data ? (
        <View style={styles.summary}>
          <SummaryCell label="用户" value={String(summaryQuery.data.userCount)} />
          <View style={styles.divider} />
          <SummaryCell label="训练" value={formatVolume(summaryQuery.data.workoutCount)} />
          <View style={styles.divider} />
          <SummaryCell label="总容量 kg" value={formatVolume(summaryQuery.data.totalVolume)} />
        </View>
      ) : null}

      <View style={styles.listCard}>
        <View style={styles.listHead}>
          <Text style={styles.listTitle}>打卡记录</Text>
          <Text style={styles.listMeta}>共 {workoutTotal} 条</Text>
        </View>

        {workoutsQuery.isLoading ? <Text style={styles.rowMeta}>正在取全站记录…</Text> : null}
        {workoutsQuery.isError ? <Text style={styles.rowMeta}>{errorText(workoutsQuery.error)}</Text> : null}
        {workoutsQuery.data?.list.length === 0 ? <Text style={styles.rowMeta}>全站还没有训练记录。</Text> : null}

        {workoutsQuery.data?.list.map((item) => (
          <WorkoutRow key={item.id} item={item} />
        ))}

        {workoutsQuery.data ? (
          <View style={styles.pager}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="上一页"
              disabled={page <= 1}
              onPress={() => setPage((value) => Math.max(1, value - 1))}
              hitSlop={8}
            >
              <Text style={[styles.pagerAction, page <= 1 && styles.pagerDisabled]}>上一页</Text>
            </Pressable>
            <Text style={styles.pagerMeta}>
              第 {page} / {totalPages} 页
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下一页"
              disabled={page >= totalPages}
              onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
              hitSlop={8}
            >
              <Text style={[styles.pagerAction, page >= totalPages && styles.pagerDisabled]}>下一页</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHead}>
          <Text style={styles.listTitle}>用户</Text>
          <Text style={styles.listMeta}>{usersQuery.data?.total ?? 0} 人</Text>
        </View>
        {usersQuery.isLoading ? <Text style={styles.rowMeta}>正在取用户列表…</Text> : null}
        {usersQuery.isError ? <Text style={styles.rowMeta}>{errorText(usersQuery.error)}</Text> : null}
        {usersQuery.data?.list.map((user) => (
          <View key={user.id} style={styles.userRow}>
            <View style={styles.userMain}>
              <Text style={styles.userPhone}>{user.phoneMasked}</Text>
              <Text style={styles.rowMeta}>加入 {user.createdAt.slice(0, 10)}</Text>
            </View>
            <Text style={styles.userRole}>{user.role === 'admin' ? '管理员' : '普通用户'}</Text>
          </View>
        ))}
        {usersQuery.data ? (
          <Text style={styles.footnote}>用户列表取第一页（20 人）；管理员无写权限，只读。</Text>
        ) : null}
      </View>
    </Screen>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function WorkoutRow({ item }: { item: AdminWorkoutItem }): React.JSX.Element {
  return (
    <View style={styles.workoutRow}>
      <View style={styles.workoutMain}>
        <Text style={styles.workoutPhone}>{item.phoneMasked}</Text>
        <Text style={styles.rowMeta}>{item.logDate}</Text>
      </View>
      <Text style={styles.workoutVolume}>{formatVolume(item.totalVolume)} kg</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginTop: spacing.sm
  },
  summaryCell: { flex: 1, paddingHorizontal: spacing.md, gap: 2 },
  summaryLabel: { color: colors.inkMuted, fontSize: fontSize.meta },
  summaryValue: {
    color: colors.ink,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums']
  },
  divider: { width: 1, backgroundColor: colors.border },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.xs
  },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  listTitle: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.semibold },
  listMeta: { color: colors.inkFaint, fontSize: fontSize.meta },
  rowMeta: { color: colors.inkMuted, fontSize: fontSize.meta },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56
  },
  workoutMain: { flex: 1, gap: 2 },
  workoutPhone: { color: colors.ink, fontSize: fontSize.body, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'] },
  workoutVolume: { color: colors.ink, fontSize: fontSize.label, fontVariant: ['tabular-nums'] },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    minHeight: 44
  },
  pagerAction: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  pagerDisabled: { color: colors.inkFaint },
  pagerMeta: { color: colors.inkMuted, fontSize: fontSize.meta, fontVariant: ['tabular-nums'] },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56
  },
  userMain: { flex: 1, gap: 2 },
  userPhone: { color: colors.ink, fontSize: fontSize.body, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'] },
  userRole: { color: colors.inkMuted, fontSize: fontSize.label },
  footnote: { color: colors.inkFaint, fontSize: fontSize.meta, lineHeight: 18, marginTop: spacing.xs }
});
