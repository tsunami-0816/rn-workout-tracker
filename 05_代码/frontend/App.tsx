import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { queryClient } from './src/queryClient';
import { useAuthStore } from './src/store/authStore';
import { AuthNavigator, MainNavigator } from './src/navigation/RootNavigator';
import { BrandLine } from './src/components/BrandMark';
import { ToastHost } from './src/components/ToastHost';
import { UpdateModal } from './src/components/UpdateModal';
import { useVersionCheck } from './src/hooks/useVersionCheck';
import { colors, spacing } from './src/theme/tokens';

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.ground,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    notification: colors.danger
  }
};

function BootScreen(): React.JSX.Element {
  return (
    <View style={styles.boot}>
      <BrandLine subtitle="正在读取登录态…" />
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function AppShell(): React.JSX.Element {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const hydrate = useAuthStore((state) => state.hydrate);
  const { update, dismiss } = useVersionCheck();
  const previousToken = useRef<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 仅「有 token → 无 token」时清缓存，避免冷启动把版本检查查询一起清掉
  useEffect(() => {
    if (previousToken.current !== null && token === null) queryClient.clear();
    previousToken.current = token;
  }, [token]);

  if (!hydrated) return <BootScreen />;

  return (
    <View style={styles.root}>
      <NavigationContainer theme={navigationTheme}>
        {token ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <ToastHost />
      <UpdateModal version={update} onDismiss={dismiss} />
    </View>
  );
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AppShell />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  boot: {
    flex: 1,
    backgroundColor: colors.ground,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg
  }
});
