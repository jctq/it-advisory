import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppTabBar } from '../../src/components/app-tab-bar';
import { useAppTheme } from '../../src/theme/use-app-theme';

/**
 * Main app area with compact custom bottom navigation (home, new diagnostic, profile).
 */
export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: theme.background },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
      tabBar={(tabProps: BottomTabBarProps) => <AppTabBar {...tabProps} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
