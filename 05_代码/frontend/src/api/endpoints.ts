import { request } from './client';
import type {
  AdminSummaryData,
  AdminUsersData,
  AdminWorkoutsData,
  CreateSetPayload,
  CurrentPlanData,
  DeleteSetData,
  ExercisesData,
  FinishWorkoutData,
  HistoryData,
  LoginData,
  MeData,
  PlansData,
  SendCodeData,
  SetMutationData,
  StartWorkoutData,
  UpdateSetPayload,
  VersionData,
  WeeklyStatsData,
  WorkoutDetailData,
  WorkoutsData
} from './types';

/** 20 个端点（G1–G4），与 06.5_契约/openapi.json 逐条对齐 */export const api = {
  // G1 认证
  sendCode: (phone: string): Promise<SendCodeData> =>
    request<SendCodeData>('POST', '/auth/send-code', { phone }),
  login: (phone: string, code: string): Promise<LoginData> =>
    request<LoginData>('POST', '/auth/login', { phone, code }),
  me: (): Promise<MeData> => request<MeData>('GET', '/auth/me'),

  // G2 计划
  plans: (): Promise<PlansData> => request<PlansData>('GET', '/plans'),
  currentPlan: (): Promise<CurrentPlanData> => request<CurrentPlanData>('GET', '/plans/current'),
  exercises: (planId: number): Promise<ExercisesData> =>
    request<ExercisesData>('GET', `/plans/${planId}/exercises`),

  // G3 训练与记录
  workouts: (page = 1, size = 20): Promise<WorkoutsData> =>
    request<WorkoutsData>('GET', `/workouts?page=${page}&size=${size}`),
  startWorkout: (planId: number): Promise<StartWorkoutData> =>
    request<StartWorkoutData>('POST', '/workouts/start', { planId }),
  workout: (id: number): Promise<WorkoutDetailData> =>
    request<WorkoutDetailData>('GET', `/workouts/${id}`),
  createSet: (workoutId: number, payload: CreateSetPayload): Promise<SetMutationData> =>
    request<SetMutationData>('POST', `/workouts/${workoutId}/sets`, payload),
  updateSet: (
    workoutId: number,
    setId: number,
    payload: UpdateSetPayload
  ): Promise<SetMutationData> =>
    request<SetMutationData>('PATCH', `/workouts/${workoutId}/sets/${setId}`, payload),
  deleteSet: (workoutId: number, setId: number): Promise<DeleteSetData> =>
    request<DeleteSetData>('DELETE', `/workouts/${workoutId}/sets/${setId}`),
  finishWorkout: (workoutId: number): Promise<FinishWorkoutData> =>
    request<FinishWorkoutData>('POST', `/workouts/${workoutId}/finish`),

  // G4 统计与运营
  weeklyStats: (): Promise<WeeklyStatsData> => request<WeeklyStatsData>('GET', '/stats/weekly'),
  history: (weeks = 4): Promise<HistoryData> =>
    request<HistoryData>('GET', `/stats/history?weeks=${weeks}`),
  adminWorkouts: (page = 1, size = 20, from?: string, to?: string): Promise<AdminWorkoutsData> => {
    const params = [`page=${page}`, `size=${size}`];
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    return request<AdminWorkoutsData>('GET', `/admin/workouts?${params.join('&')}`);
  },
  adminUsers: (page = 1, size = 20): Promise<AdminUsersData> =>
    request<AdminUsersData>('GET', `/admin/users?page=${page}&size=${size}`),
  adminSummary: (): Promise<AdminSummaryData> =>
    request<AdminSummaryData>('GET', '/admin/stats/summary'),

  // 版本
  appVersion: (): Promise<VersionData> => request<VersionData>('GET', '/app/version')
};

