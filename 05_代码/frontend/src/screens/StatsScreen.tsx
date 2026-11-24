import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorText } from '../api/errors';
import type { WeekPoint } from '../api/types';
import { queryKeys } from '../queryClient';
import { AppHeader } from '../components/AppHeader';
import { BrandLine } from '../components/BrandMark';
import { Screen } from '../components/Screen';
import { StateView } from '../components/StateView';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';
import { formatVolume, shortDate } from '../utils/format';

const BAR_AREA = 120;

export function StatsScreen(): React.JSX.Element {
  const weeklyQuery = useQuery({ queryKey: queryKeys.weekly, queryFn: api.weeklyStats, staleTime: 0 });
  const historyQuery = useQuery({ queryKey: queryKeys.history, queryFn: () => api.history(4) });

  const weekly = weeklyQuery.data;
  const hasTraining = (weekly?.days ?? 0) > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BrandLine subtitle="每周回看 · 只用真实打卡数据" />
        <AppHeader title="统计" subtitle={hasTraining ? '本周的数字来自服务端聚合' : '本周还没有打卡记录'} />

        {weeklyQuery.isLoading ? <StateView mode="loading" message="正在算本周统计…" /> : null}

        {weeklyQuery.isError ? (
          <StateView
            mode="error"
            message={errorText(weeklyQuery.error)}
            onRetry={() => {
              void weeklyQuery.refetch();
            }}
          />
        ) : null}

        {weekly ? (
          <>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCell}>
                <Text style={styles.kpiLabel}>本周打卡</Text>
                <Text style={styles.kpiValue}>
                  {weekly.days}
                  <Text style={styles.kpiUnit}> 天</Text>
                </Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiCell}>
                <Text style={styles.kpiLabel}>本周总容量</Text>
                <Text style={styles.kpiValue}>
                  {formatVolume(weekly.totalVolume)}
                  <Text style={styles.kpiUnit}> kg</Text>
                </Text>
              </View>
            </View>

            {!hasTraining ? (
              <Text style={styles.emptyLine}>
                本周还没打卡：完成一次训练后，天数和容量会立即出现在这里（统计缓存写后失效）。
              </Text>
            ) : null}

            <View style={styles.chartCard}>
              <View style={styles.chartHead}>
                <Text style={styles.chartTitle}>近 4 周容量</Text>
                <Text style={styles.chartMeta}>kg · 每周一为起点</Text>
              </View>
              <View style={styles.bars}>
                {weekly.series.map((point) => (
                  <Bar key={point.weekStart} point={point} max={maxVolume(weekly.series)} />
                ))}
              </View>
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.chartTitle}>最近的训练</Text>
              {historyQuery.isLoading ? <Text style={styles.rowMeta}>正在取历史…</Text> : null}
              {historyQuery.isError ? (
                <Text style={styles.rowMeta}>{errorText(historyQuery.error)}</Text>
              ) : null}
              {historyQuery.data?.list.length === 0 ? (
                <Text style={styles.rowMeta}>最近 4 周没有训练记录。</Text>
              ) : null}
              {historyQuery.data?.list.map((item, index) => (
                <View key={`${item.logDate}-${index}`} style={styles.historyRow}>
                  <View style={styles.historyMain}>
                    <Text style={styles.historyDate}>{item.logDate}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.planName}
                    </Text>
                  </View>
                  <Text style={styles.historyVolume}>{formatVolume(item.totalVolume)} kg</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function maxVolume(series: WeekPoint[]): number {
  return series.reduce((max, point) => Math.max(max, point.volume), 0);
}

function Bar({ point, max }: { point: WeekPoint; max: number }): React.JSX.Element {
  const ratio = max > 0 ? point.volume / max : 0;
  const height = point.volume > 0 ? 12 + Math.round(ratio * (BAR_AREA - 12)) : 2;
  return (
    <View style={styles.barCol}>
      <Text style={styles.barValue}>{formatVolume(point.volume)}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height }]} />
      </View>
      <Text style={styles.barLabel}>{shortDate(point.weekStart)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  kpiCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm
  },
  kpiCell: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.xxs },
  kpiDivider: { width: 1, backgroundColor: colors.border },
  kpiLabel: { color: colors.inkMuted, fontSize: fontSize.label },
  kpiValue: {
    color: colors.ink,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5
  },
  kpiUnit: { color: colors.inkMuted, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  emptyLine: { color: colors.inkMuted, fontSize: fontSize.label, lineHeight: 20, marginTop: spacing.xs },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chartTitle: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.semibold },
  chartMeta: { color: colors.inkFaint, fontSize: fontSize.meta },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: BAR_AREA + 44 },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.xxs, justifyContent: 'flex-end' },
  barValue: { color: colors.inkMuted, fontSize: fontSize.meta, fontVariant: ['tabular-nums'] },
  barTrack: {
    width: '70%',
    height: BAR_AREA,
    justifyContent: 'flex-end',
    backgroundColor: colors.ground,
    borderRadius: radius.sm
  },
  barFill: { width: '100%', backgroundColor: colors.accent, borderRadius: radius.sm },
  barLabel: { color: colors.inkFaint, fontSize: fontSize.meta },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  historyMain: { flex: 1, gap: 2 },
  historyDate: { color: colors.ink, fontSize: fontSize.body, fontWeight: fontWeight.medium, fontVariant: ['tabular-nums'] },
  rowMeta: { color: colors.inkMuted, fontSize: fontSize.meta },
  historyVolume: { color: colors.ink, fontSize: fontSize.label, fontVariant: ['tabular-nums'] }
});
