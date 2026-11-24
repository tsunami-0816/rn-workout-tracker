import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing, touchTarget } from '../theme/tokens';
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from './types';
import { LoginScreen } from '../screens/LoginScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { StatsScreen } from '../screens/StatsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { LogScreen } from '../screens/LogScreen';
import { AdminScreen } from '../screens/AdminScreen';

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Plans: '计划',
  Stats: '统计',
  Profile: '我的'
};

/** 文字型底栏：三个目的地，选中态只换文字色与底部 2px 线（不用图标堆叠） */
function TextTabBar({ state, descriptors, navigation }: BottomTabBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label =
          descriptors[route.key]?.options.tabBarLabel ??
          TAB_LABELS[route.name as keyof MainTabParamList] ??
          route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={typeof label === 'string' ? label : route.name}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tabItem}
          >
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
              {typeof label === 'string' ? label : route.name}
            </Text>
            <View style={[styles.indicator, focused && styles.indicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      tabBar={(props) => <TextTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface }
      }}
    >
      <Tab.Screen name="Plans" component={PlansScreen} options={{ tabBarLabel: TAB_LABELS.Plans }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: TAB_LABELS.Stats }} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: TAB_LABELS.Profile }}
      />
    </Tab.Navigator>
  );
}

/** 已登录路由：MainTabs + 今日训练 / 记录 / admin 子页 */
export function MainNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ground },
        animation: 'slide_from_right'
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Workout" component={WorkoutScreen} />
      <Stack.Screen name="Log" component={LogScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
    </Stack.Navigator>
  );
}

/** 未登录路由：只有登录页，守卫生效（不靠手动 navigate 循环） */
export function AuthNavigator(): React.JSX.Element {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs
  },
  tabItem: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs
  },
  tabLabel: { fontSize: fontSize.body, fontWeight: fontWeight.medium, color: colors.inkMuted },
  tabLabelActive: { color: colors.accent, fontWeight: fontWeight.semibold },
  indicator: { width: 18, height: 2, borderRadius: radius.pill, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.accent }
});
