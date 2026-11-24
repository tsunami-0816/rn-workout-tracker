import { create } from 'zustand';
import type { Role, UserSummary } from '../api/types';
import { authStorage } from '../storage/authStorage';

interface PersistedUser {
  id: number;
  nickname: string;
  role: Role;
}

interface AuthState {
  token: string | null;
  user: PersistedUser | null;
  /** 冷启动读本地凭据完成前为 false，避免闪登录页 */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (token: string, user: UserSummary) => Promise<void>;
  signOut: () => Promise<void>;
  /** 401 时同步清内存，存储异步清（不阻塞跳转） */
  clearSession: () => void;
}

function parseUser(raw: string | null): PersistedUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'nickname' in parsed &&
      'role' in parsed
    ) {
      const record = parsed as Record<string, unknown>;
      if (
        typeof record.id === 'number' &&
        typeof record.nickname === 'string' &&
        (record.role === 'user' || record.role === 'admin')
      ) {
        return { id: record.id, nickname: record.nickname, role: record.role };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const [token, rawUser] = await Promise.all([authStorage.getToken(), authStorage.getUser()]);
    set({ token, user: parseUser(rawUser), hydrated: true });
  },

  signIn: async (token, user) => {
    await Promise.all([authStorage.setToken(token), authStorage.setUser(JSON.stringify(user))]);
    set({ token, user: { id: user.id, nickname: user.nickname, role: user.role }, hydrated: true });
  },

  signOut: async () => {
    set({ token: null, user: null });
    await authStorage.clear();
  },

  clearSession: () => {
    set({ token: null, user: null });
    void authStorage.clear();
  }
}));
