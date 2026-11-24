/** 后端统一响应与各端点 data 类型；字段名与 06.5_契约/openapi.json + mock/samples.json 对齐 */

export type Role = 'user' | 'admin';

export interface UserSummary {
  id: number;
  nickname: string;
  role: Role;
}

export interface MeData {
  id: number;
  nickname: string;
  phoneMasked: string;
  role: Role;
}

export interface SendCodeData {
  cooldown: number;
}

export interface LoginData {
  token: string;
  expiresIn: number;
  user: UserSummary;
}

export type DayType = '推' | '拉' | '腿';

export interface PlanSummary {
  id: number;
  name: string;
  dayType: DayType;
  weekDone: number;
}

export interface PlansData {
  list: PlanSummary[];
  todayPlanId: number | null;
  /** 今天已经开练的计划 id；非空表示其他分化卡当天不可再开（F-02） */
  todayWorkoutPlanId?: number | null;
}

export interface CurrentPlanData {
  id: number;
  name: string;
  dayType: DayType;
  exercisesCount: number;
}

export interface Exercise {
  id: number;
  name: string;
  targetSets: number;
  targetReps: number;
  orderNo: number;
}

export interface ExercisesData {
  list: Exercise[];
}

export interface WorkoutListItem {
  id: number;
  logDate: string;
  totalVolume: number;
  finished: boolean;
}

export interface WorkoutsData {
  list: WorkoutListItem[];
  total: number;
  page: number;
  size: number;
}

export interface StartWorkoutData {
  workoutId: number;
  logDate: string;
  totalVolume: number;
}

export interface SetLog {
  id: number;
  exerciseId: number;
  setNo: number;
  weight: number;
  reps: number;
  done: boolean;
}

export interface WorkoutDetailData {
  id: number;
  planId: number;
  logDate: string;
  totalVolume: number;
  finished: boolean;
  sets: SetLog[];
}

export interface SetMutationData {
  setLog: SetLog;
  totalVolume: number;
}

export interface DeleteSetData {
  totalVolume: number;
}

export interface FinishWorkoutData {
  finishedAt: string;
  totalVolume: number;
}

export interface WeekPoint {
  weekStart: string;
  volume: number;
}

export interface WeeklyStatsData {
  days: number;
  totalVolume: number;
  series: WeekPoint[];
}

export interface HistoryItem {
  logDate: string;
  totalVolume: number;
  planName: string;
}

export interface HistoryData {
  list: HistoryItem[];
}

export interface AdminWorkoutItem {
  id: number;
  phoneMasked: string;
  logDate: string;
  totalVolume: number;
}

export interface AdminWorkoutsData {
  list: AdminWorkoutItem[];
  total: number;
  page: number;
  size: number;
}

export interface AdminUserItem {
  id: number;
  phoneMasked: string;
  role: Role;
  createdAt: string;
}

export interface AdminUsersData {
  list: AdminUserItem[];
  total: number;
}

export interface AdminSummaryData {
  userCount: number;
  workoutCount: number;
  totalVolume: number;
}

export interface VersionData {
  version: string;
  buildNo: number;
  apkUrl: string;
  notes: string;
}

export interface CreateSetPayload {
  exerciseId: number;
  setNo: number;
  weight: number;
  reps: number;
  done: boolean;
}

export interface UpdateSetPayload {
  weight?: number;
  reps?: number;
  done?: boolean;
}
