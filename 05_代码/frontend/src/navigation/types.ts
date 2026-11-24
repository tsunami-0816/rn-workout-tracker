import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Plans: undefined;
  Stats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Workout: { planId: number; planName: string };
  Log: {
    planId: number;
    planName: string;
    exerciseId: number;
    exerciseName: string;
    targetSets: number;
    targetReps: number;
  };
  Admin: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
export type TabNavigation = BottomTabNavigationProp<MainTabParamList>;
