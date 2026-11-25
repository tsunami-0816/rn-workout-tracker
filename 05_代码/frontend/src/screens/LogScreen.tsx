import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { errorText } from '../api/errors';
import type { SetLog } from '../api/types';
import { queryClient, queryKeys } from '../queryClient';
import { showToast } from '../store/toastStore';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { StateView } from '../components/StateView';
import { SetRowCard, type DraftRow } from '../components/SetRow';
import { Screen } from '../components/Screen';
import type { RootNavigation, RootStackParamList } from '../navigation/types';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';
import { formatVolume, stepReps, stepWeight } from '../utils/format';

const DEFAULT_WEIGHT = 20;
const DEFAULT_REST_REPS = 10;

export function LogScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Log'>>();
  const { planId, planName, exerciseId, exerciseName, targetSets, targetReps } = route.params;

  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [totalVolume, setTotalVolume] = useState<number | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [finishing, setFinishing] = useState(false);
  const startInFlight = useRef(false);
  const patchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const startWorkout = useCallback(async (): Promise<void> => {
    if (startInFlight.current) return;
    startInFlight.current = true;
    setStartError(null);
    try {
      const data = await api.startWorkout(planId);
      setWorkoutId(data.workoutId);
      setTotalVolume(data.totalVolume);
    } catch (error) {
      setStartError(errorText(error));
    } finally {
      startInFlight.current = false;
    }
  }, [planId]);

  useEffect(() => {
    void startWorkout();
  }, [startWorkout]);

  useEffect(() => {
    const timers = patchTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const workoutQuery = useQuery({
    queryKey: queryKeys.workout(workoutId ?? 0),
    queryFn: async () => {
      if (workoutId === null) throw new Error('workout 尚未创建');
      return api.workout(workoutId);
    },
    enabled: workoutId !== null
  });

  useEffect(() => {
    if (!workoutQuery.data) return;
    const saved: SetLog[] = workoutQuery.data.sets.filter((set) => set.exerciseId === exerciseId);
    const count = Math.max(targetSets, 1);
    setRows(
      Array.from({ length: count }, (_, index) => {
        const setNo = index + 1;
        const found = saved.find((set) => set.setNo === setNo);
        return {
          setNo,
          weight: found?.weight ?? DEFAULT_WEIGHT,
          reps: found?.reps ?? (targetReps > 0 ? targetReps : DEFAULT_REST_REPS),
          done: found?.done ?? false,
          serverId: found?.id,
          status: found ? 'saved' : 'idle'
        } satisfies DraftRow;
      })
    );
    setTotalVolume(workoutQuery.data.totalVolume);
    setWorkoutFinished(workoutQuery.data.finished);
  }, [workoutQuery.data, exerciseId, targetSets, targetReps]);

  const updateRow = (setNo: number, patch: Partial<DraftRow>): void => {
    setRows((previous) =>
      previous.map((row) => (row.setNo === setNo ? { ...row, ...patch } : row))
    );
  };

  const invalidateStats = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.weekly });
    void queryClient.invalidateQueries({ queryKey: queryKeys.history });
  };

  /** 把某一行写到服务端：已保存走 PATCH，未保存走 POST（复合唯一键幂等） */
  const persistRow = useCallback(
    async (row: DraftRow, nextDone: boolean): Promise<void> => {
      if (workoutId === null) return;
      // 显式提交前先取消该行待执行的防抖 PATCH，避免旧快照把 done 覆盖回去
      const pendingTimer = patchTimers.current[row.setNo];
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        delete patchTimers.current[row.setNo];
      }
      updateRow(row.setNo, { status: 'pending', done: nextDone });
      try {
        const result = row.serverId
          ? await api.updateSet(workoutId, row.serverId, {
              weight: row.weight,
              reps: row.reps,
              done: nextDone
            })
          : await api.createSet(workoutId, {
              exerciseId,
              setNo: row.setNo,
              weight: row.weight,
              reps: row.reps,
              done: nextDone
            });
        updateRow(row.setNo, {
          serverId: result.setLog.id,
          done: result.setLog.done,
          status: 'saved'
        });
        setTotalVolume(result.totalVolume);
        invalidateStats();
      } catch (error) {
        // 保留用户填写的 done 意图，重试时按原意图提交；只把行标红
        updateRow(row.setNo, { status: 'error' });
        showToast(errorText(error), 'error');
      }
    },
    [workoutId, exerciseId, workoutQuery]
  );

  const schedulePersist = (row: DraftRow): void => {
    if (!row.serverId) return;
    const existing = patchTimers.current[row.setNo];
    if (existing) clearTimeout(existing);
    patchTimers.current[row.setNo] = setTimeout(() => {
      void persistRow(row, row.done);
    }, 450);
  };

  const changeWeight = (row: DraftRow, delta: number): void => {
    const next = { ...row, weight: stepWeight(row.weight, delta) };
    updateRow(row.setNo, { weight: next.weight });
    schedulePersist(next);
  };

  const changeReps = (row: DraftRow, delta: number): void => {
    const next = { ...row, reps: stepReps(row.reps, delta) };
    updateRow(row.setNo, { reps: next.reps });
    schedulePersist(next);
  };

  const toggleDone = (row: DraftRow): void => {
    if (workoutFinished) {
      showToast('本次训练已结束，记录已锁定，不能再改', 'error');
      return;
    }
    if (row.status === 'pending') return;
    const nextDone = !row.done;
    updateRow(row.setNo, { done: nextDone });
    void persistRow({ ...row, done: nextDone }, nextDone);
  };

  const removeRow = async (row: DraftRow): Promise<void> => {
    if (workoutId === null || workoutFinished) return;
    const pendingTimer = patchTimers.current[row.setNo];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      delete patchTimers.current[row.setNo];
    }
    if (!row.serverId) {
      updateRow(row.setNo, { done: false, status: 'idle', weight: DEFAULT_WEIGHT, reps: targetReps });
      return;
    }
    updateRow(row.setNo, { status: 'pending' });
    try {
      const result = await api.deleteSet(workoutId, row.serverId);
      updateRow(row.setNo, {
        serverId: undefined,
        done: false,
        status: 'idle',
        weight: DEFAULT_WEIGHT,
        reps: targetReps > 0 ? targetReps : DEFAULT_REST_REPS
      });
      setTotalVolume(result.totalVolume);
      invalidateStats();
    } catch (error) {
      updateRow(row.setNo, { status: 'error' });
      showToast(errorText(error), 'error');
    }
  };

  const finishWorkout = async (): Promise<void> => {
    if (workoutId === null || workoutFinished) return;
    setFinishing(true);
    try {
      const result = await api.finishWorkout(workoutId);
      setWorkoutFinished(true);
      setTotalVolume(result.totalVolume);
      invalidateStats();
      showToast('本次训练已结束，统计已刷新', 'success');
    } catch (error) {
      showToast(errorText(error), 'error');
    } finally {
      setFinishing(false);
    }
  };

  const rowsSum = rows.filter((row) => row.done).reduce((sum, row) => sum + row.weight * row.reps, 0);

  return (
    <Screen>
      <AppHeader
        title={`记录 · ${exerciseName}`}
        subtitle={`${planName} · 目标 ${targetSets} 组 × ${targetReps} 次`}
        onBack={() => navigation.goBack()}
        right={
          workoutFinished ? <Text style={styles.finishedTag}>已结束</Text> : null
        }
      />

      {startError ? (
        <StateView
          mode="error"
          message={startError}
          onRetry={() => {
            void startWorkout();
          }}
        />
      ) : null}

      {!startError && workoutId === null ? <StateView mode="loading" message="正在开始今日训练…" /> : null}

      {workoutId !== null && workoutQuery.isError ? (
        <StateView
          mode="error"
          message={errorText(workoutQuery.error)}
          onRetry={() => {
            void workoutQuery.refetch();
          }}
        />
      ) : null}

      {workoutId !== null && workoutQuery.isLoading ? <StateView mode="loading" message="正在取本次组次…" /> : null}

      {workoutId !== null && workoutQuery.data ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>本次总容量</Text>
            <Text style={styles.summaryValue}>
              {formatVolume(totalVolume ?? rowsSum)}
              <Text style={styles.unit}> kg</Text>
            </Text>
            <View style={styles.summaryMeta}>
              <Text style={styles.metaText}>
                已记 {rows.filter((row) => row.serverId).length}/{rows.length} 组
              </Text>
              <Text style={styles.metaText}>
                {workoutFinished ? '训练已结束' : '每点一次 ± 立即改值，勾选即提交'}
              </Text>
            </View>
          </View>

          {rows.map((row) => (
            <SetRowCard
              key={row.setNo}
              row={row}
              disabled={workoutFinished}
              onWeight={(delta) => changeWeight(row, delta)}
              onReps={(delta) => changeReps(row, delta)}
              onToggle={() => toggleDone(row)}
              onRetry={() => {
                void persistRow(row, row.done);
              }}
              onDelete={() => {
                void removeRow(row);
              }}
            />
          ))}

          <View style={styles.footer}>
            <AppButton
              label={workoutFinished ? '本次训练已结束' : '结束本次训练'}
              onPress={() => {
                void finishWorkout();
              }}
              loading={finishing}
              disabled={workoutFinished}
            />
            <Text style={styles.footnote}>
              同一组重复提交只会覆盖原行（服务端复合唯一键），不会产生第二条记录。
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  finishedTag: { color: colors.inkMuted, fontSize: fontSize.label },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs
  },
  summaryLabel: { color: colors.inkMuted, fontSize: fontSize.label },
  summaryValue: {
    color: colors.ink,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5
  },
  unit: { color: colors.inkMuted, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  summaryMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metaText: { color: colors.inkMuted, fontSize: fontSize.meta },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
  footnote: { color: colors.inkFaint, fontSize: fontSize.meta, lineHeight: 18 }
});
