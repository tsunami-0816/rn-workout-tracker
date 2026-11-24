import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorText } from '../api/errors';
import type { PlanSummary } from '../api/types';
import { queryKeys } from '../queryClient';
import { AppHeader } from '../components/AppHeader';
import { BrandLine } from '../components/BrandMark';
import { Screen } from '../components/Screen';
import { StateView } from '../components/StateView';
import { showToast } from '../store/toastStore';
import type { RootNavigation } from '../navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

export function PlansScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const plansQuery = useQuery({ queryKey: queryKeys.plans, queryFn: api.plans });
  const currentQuery = useQuery({ queryKey: queryKeys.currentPlan, queryFn: api.currentPlan });

  const plans = plansQuery.data?.list ?? [];
  const todayPlanId = plansQuery.data?.todayPlanId ?? -1;
  // 今天已开练的分化：其余两张卡当天不可再开（F-02，后端同日换 plan 会 40002）
  const activePlanId = plansQuery.data?.todayWorkoutPlanId ?? null;
  const activePlanName = plans.find((p) => p.id === activePlanId)?.name ?? '当天计划';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BrandLine subtitle="三日分化 · 推 / 拉 / 腿" />
        <AppHeader
          title="计划"
          subtitle={currentQuery.data ? `今天练${currentQuery.data.dayType}：${currentQuery.data.name}` : '按分化安排练，不临时改计划'}
          right={
            currentQuery.data ? (
              <Text style={styles.headerMeta}>{currentQuery.data.exercisesCount} 个动作</Text>
            ) : null
          }
        />

        {plansQuery.isLoading ? <StateView mode="loading" message="正在取你的计划…" /> : null}

        {plansQuery.isError ? (
          <StateView
            mode="error"
            message={errorText(plansQuery.error)}
            onRetry={() => {
              void plansQuery.refetch();
            }}
          />
        ) : null}

        {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 ? (
          <StateView mode="empty" message="账号下还没有分化计划" hint="用 seed 初始化的演示账号会自带推 / 拉 / 腿三份计划。" />
        ) : null}

        {plans.map((plan) => {
          const lockedToday = activePlanId !== null && plan.id !== activePlanId;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              today={plan.id === todayPlanId}
              activeToday={plan.id === activePlanId}
              disabled={lockedToday}
              onPress={() => {
                if (lockedToday) {
                  showToast(`今天已按「${activePlanName}」开练，明天再练「${plan.name}」`, 'info');
                  return;
                }
                navigation.navigate('Workout', { planId: plan.id, planName: plan.name });
              }}
            />
          );
        })}

        {!plansQuery.isLoading && !plansQuery.isError && plans.length > 0 ? (
          <Text style={styles.footnote}>
            完成度按本周该分化的打卡次数统计；次数来自服务端，不在客户端估算。
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

interface PlanCardProps {
  plan: PlanSummary;
  today: boolean;
  activeToday: boolean;
  disabled: boolean;
  onPress: () => void;
}

function PlanCard({ plan, today, activeToday, disabled, onPress }: PlanCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`${today ? '今日推荐，' : ''}${plan.name}，本周 ${plan.weekDone} 次${
        disabled ? '，今天已按其他分化开练' : ''
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        today && styles.cardToday,
        activeToday && styles.cardActive,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.dayType}>
          <Text style={styles.dayTypeText}>{plan.dayType}</Text>
        </View>
        {today ? <Text style={styles.todayTag}>今天</Text> : null}
        {activeToday ? <Text style={styles.activeTag}>已开练</Text> : null}
        <View style={styles.spacer} />
        <Text style={styles.enter}>{disabled ? '明天' : '进入'}</Text>
      </View>
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.weekDone}>本周 {plan.weekDone} 次</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  headerMeta: { color: colors.inkMuted, fontSize: fontSize.label },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    marginTop: spacing.sm
  },
  cardToday: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.86 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayType: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt
  },
  dayTypeText: { color: colors.ink, fontSize: fontSize.meta, fontWeight: fontWeight.semibold },
  todayTag: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  activeTag: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold },
  spacer: { flex: 1 },
  enter: { color: colors.inkMuted, fontSize: fontSize.label },
  planName: { color: colors.ink, fontSize: fontSize.heading, fontWeight: fontWeight.semibold },
  weekDone: { color: colors.inkMuted, fontSize: fontSize.label },
  footnote: { color: colors.inkFaint, fontSize: fontSize.meta, lineHeight: 18, marginTop: spacing.sm }
});
