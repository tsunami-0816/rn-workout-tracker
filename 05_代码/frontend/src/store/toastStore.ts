import { create } from 'zustand';

export type ToastKind = 'info' | 'error' | 'success';

interface ToastState {
  message: string;
  kind: ToastKind;
  /** 每次 show 自增，ToastHost 用它重启动画与计时 */
  seq: number;
  show: (message: string, kind?: ToastKind) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  message: '',
  kind: 'info',
  seq: 0,
  show: (message, kind = 'info') => set({ message, kind, seq: get().seq + 1 }),
  hide: () => set({ message: '' })
}));

/** 任意模块（含 apiClient）可调用的全局提示 */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  useToastStore.getState().show(message, kind);
}
