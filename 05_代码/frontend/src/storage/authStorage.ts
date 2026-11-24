import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** SecureStore 主存储；不可用（Web / Keystore 异常）时自动降级 AsyncStorage（D-13） */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

let secureStoreAvailable = Platform.OS !== 'web';

async function read(key: string): Promise<string | null> {
  if (secureStoreAvailable) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      secureStoreAvailable = false;
    }
  }
  return AsyncStorage.getItem(key);
}

async function write(key: string, value: string): Promise<void> {
  if (secureStoreAvailable) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      secureStoreAvailable = false;
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function remove(key: string): Promise<void> {
  if (secureStoreAvailable) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      secureStoreAvailable = false;
    }
  }
  await AsyncStorage.removeItem(key);
}

export const authStorage = {
  getToken: (): Promise<string | null> => read(TOKEN_KEY),
  setToken: (token: string): Promise<void> => write(TOKEN_KEY, token),
  getUser: (): Promise<string | null> => read(USER_KEY),
  setUser: (json: string): Promise<void> => write(USER_KEY, json),
  clear: async (): Promise<void> => {
    await Promise.all([remove(TOKEN_KEY), remove(USER_KEY)]);
  },
  /** 测试与诊断用：当前是否仍在用 Keystore */
  isSecureStoreAvailable: (): boolean => secureStoreAvailable
};
