import { QueryClient } from '@tanstack/react-query';

/** 重试交给 apiClient（只对 GET 重试 1 次），这里不再叠加；统计类数据保持新鲜 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: false
    }
  }
});

export const queryKeys = {
  plans: ['plans'] as const,
  currentPlan: ['plans', 'current'] as const,
  exercises: (planId: number) => ['plans', planId, 'exercises'] as const,
  workout: (workoutId: number) => ['workouts', workoutId] as const,
  weekly: ['stats', 'weekly'] as const,
  history: ['stats', 'history'] as const,
  me: ['auth', 'me'] as const,
  adminSummary: ['admin', 'summary'] as const,
  adminWorkouts: (page: number) => ['admin', 'workouts', page] as const,
  adminUsers: ['admin', 'users'] as const,
  version: ['app', 'version'] as const
};
