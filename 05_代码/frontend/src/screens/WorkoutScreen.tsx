import React, { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorText } from '../api/errors';
import type { Exercise } from '../api/types';
import { perfFixtureEnabled } from '../config';
import { queryKeys } from '../queryClient';
import { showToast } from '../store/toastStore';
import { AppHeader } from '../components/AppHeader';
import { Screen } from '../components/Screen';
import { StateView } from '../components/StateView';
import type { RootNavigation, RootStackParamList } from '../navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

/** C02 行高口径：固定 64，getItemLayout 才能成立，行内禁止动态高度 */
const ROW_HEIGHT = 64;
const FIXTURE_COUNT = 100;

function buildFixture(): Exercise[] {
  return Array.from({ length: FIXTURE_COUNT }, (_, index) => ({
    id: -(index + 1),
    name: `性能夹具动作 ${index + 1}`,
    targetSets: 3,
    targetReps: 12,
    orderNo: 1000 + index
  }));
}

export function WorkoutScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Workout'>>();
  const { planId, planName } = route.params;
  const fixtureOn = perfFixtureEnabled();

  const exercisesQuery = useQuery({
    queryKey: queryKeys.exercises(planId),
    queryFn: () => api.exercises(planId)
  });

  const data = useMemo(() => {
    const real = exercisesQuery.data?.list ?? [];
    return fixtureOn ? [...real, ...buildFixture()] : real;
  }, [exercisesQuery.data, fixtureOn]);

  return (
    <Screen>
      <AppHeader
        title={planName}
        subtitle={`${data.length} 个动作 · 点一个动作进入记录`}
        onBack={() => navigation.goBack()}
      />

      {fixtureOn ? (
        <View style={styles.fixtureBanner}>
          <Text style={styles.fixtureText}>
            性能模式：真实动作后拼接 100 条夹具（D-06 / C02），关闭 EXPO_PUBLIC_PERF_FIXTURE 即恢复
          </Text>
        </View>
      ) : null}

      {exercisesQuery.isLoading ? <StateView mode="loading" message="正在取动作清单…" /> : null}

      {exercisesQuery.isError ? (
        <StateView
          mode="error"
          message={errorText(exercisesQuery.error)}
          onRetry={() => {
            void exercisesQuery.refetch();
          }}
        />
      ) : null}

      {!exercisesQuery.isLoading && !exercisesQuery.isError && data.length === 0 ? (
        <StateView mode="empty" message="这个计划下还没有动作" hint="回到计划页换一个分化，或检查 seed 是否完整。" />
      ) : null}

      {data.length > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              onPress={() =>
                item.id < 0
                  ? showToast('性能夹具行只用于滚动采样，不参与提交', 'info')
                  : navigation.navigate('Log', {
                      planId,
                      planName,
                      exerciseId: item.id,
                      exerciseName: item.name,
                      targetSets: item.targetSets,
                      targetReps: item.targetReps
                    })
              }
            />
          )}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : null}
    </Screen>
  );
}

interface ExerciseRowProps {
  exercise: Exercise;
  onPress: () => void;
}

const ExerciseRow = memo(function ExerciseRow({ exercise, onPress }: ExerciseRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}，${exercise.targetSets} 组，每组 ${exercise.targetReps} 次`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.order}>{exercise.orderNo}</Text>
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={styles.target}>
          {exercise.targetSets} 组 × {exercise.targetReps} 次
        </Text>
      </View>
      <Text style={styles.action}>记录</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xxl },
  fixtureBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs
  },
  fixtureText: { color: colors.accent, fontSize: fontSize.meta, lineHeight: 17 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  order: {
    width: 28,
    color: colors.inkFaint,
    fontSize: fontSize.meta,
    fontVariant: ['tabular-nums'],
    textAlign: 'right'
  },
  rowMain: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontSize: fontSize.body + 1, fontWeight: fontWeight.medium },
  target: { color: colors.inkMuted, fontSize: fontSize.meta, fontVariant: ['tabular-nums'] },
  action: { color: colors.accent, fontSize: fontSize.label, fontWeight: fontWeight.semibold }
});
