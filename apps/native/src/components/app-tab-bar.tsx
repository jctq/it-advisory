import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiagnosticFlow } from '../providers/diagnostic-flow-provider';
import { useAppTheme } from '../theme/use-app-theme';

/** Content height of the tab strip (excluding root safe-area padding). */
const TAB_BAR_CONTENT_HEIGHT = 64;
const COLUMN_COUNT = 3;
const INDICATOR_SIZE = 44;
const ICON_SIZE = 24;
const PLUS_ICON_SIZE = 28;

type TabRouteName = 'index' | 'profile';

/**
 * Compact bottom navigation: Home, new diagnostic, Profile with a spring-animated active pill.
 */
export function AppTabBar(props: BottomTabBarProps) {
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { executeReset } = useDiagnosticFlow();
  const [barWidth, setBarWidth] = useState(0);
  const activeRouteName = props.state.routes[props.state.index]?.name;
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value }],
  }));
  useEffect(() => {
    if (barWidth <= 0) {
      return;
    }
    const slotWidth = barWidth / COLUMN_COUNT;
    const routeIndex = Math.min(Math.max(props.state.index, 0), 1);
    const visualColumn = routeIndex === 0 ? 0 : 2;
    const centerX = (visualColumn + 0.5) * slotWidth;
    const nextX = centerX - INDICATOR_SIZE / 2;
    indicatorX.value = withSpring(nextX, {
      damping: 18,
      mass: 0.85,
      stiffness: 220,
    });
    indicatorOpacity.value = withSpring(1, {
      damping: 20,
      stiffness: 260,
    });
  }, [barWidth, indicatorOpacity, indicatorX, props.state.index]);
  const executeOpenNewDiagnostic = (): void => {
    void executeReset({ shouldNotify: false })
      .catch(() => {})
      .finally(() => {
        router.push('/diagnostic');
      });
  };
  const executeNavigateTab = (routeName: TabRouteName): void => {
    props.navigation.navigate(routeName);
  };
  const executeBarLayout = (event: LayoutChangeEvent): void => {
    setBarWidth(event.nativeEvent.layout.width);
  };
  const indicatorTop = (TAB_BAR_CONTENT_HEIGHT - INDICATOR_SIZE) / 2;
  const indicatorFillColor = colorScheme === 'dark' ? theme.surfaceMuted : theme.surface;
  return (
    <View
      pointerEvents="box-none"
      style={{
        backgroundColor: theme.tabBarFill,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      <View
        onLayout={executeBarLayout}
        style={[
          styles.bar,
          {
            backgroundColor: theme.tabBarFill,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              backgroundColor: indicatorFillColor,
              borderColor: colorScheme === 'dark' ? theme.border : 'transparent',
              borderWidth: colorScheme === 'dark' ? StyleSheet.hairlineWidth : 0,
              height: INDICATOR_SIZE,
              shadowColor: theme.primary,
              top: indicatorTop,
              width: INDICATOR_SIZE,
            },
            animatedIndicatorStyle,
          ]}
        />
        <View style={styles.row} pointerEvents="box-none">
          <Pressable
            accessibilityLabel="Home"
            accessibilityRole="button"
            accessibilityState={{ selected: activeRouteName === 'index' }}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            onPress={() => executeNavigateTab('index')}
            style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons
              color={activeRouteName === 'index' ? theme.primary : theme.textSoft}
              name={activeRouteName === 'index' ? 'home' : 'home-outline'}
              size={ICON_SIZE}
            />
          </Pressable>
          <Pressable
            accessibilityHint="Starts a new guided diagnostic from scratch"
            accessibilityLabel="New diagnostic"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            onPress={executeOpenNewDiagnostic}
            style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View
              style={[
                styles.plusBadge,
                {
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                },
              ]}
            >
              <Ionicons color={theme.onPrimary} name="add" size={PLUS_ICON_SIZE} />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Profile"
            accessibilityRole="button"
            accessibilityState={{ selected: activeRouteName === 'profile' }}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            onPress={() => executeNavigateTab('profile')}
            style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons
              color={activeRouteName === 'profile' ? theme.primary : theme.textSoft}
              name={activeRouteName === 'profile' ? 'person' : 'person-outline'}
              size={ICON_SIZE}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    height: TAB_BAR_CONTENT_HEIGHT,
    overflow: 'visible',
    position: 'relative',
  },
  activePill: {
    borderRadius: INDICATOR_SIZE / 2,
    elevation: 3,
    left: 0,
    position: 'absolute',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    zIndex: 0,
  },
  row: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    height: TAB_BAR_CONTENT_HEIGHT,
    justifyContent: 'center',
  },
  plusBadge: {
    alignItems: 'center',
    borderRadius: 999,
    elevation: 4,
    height: 40,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    width: 40,
  },
});
