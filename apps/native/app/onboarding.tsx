import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  type ListRenderItem,
  NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../src/components/app-button';
import { ThemedText } from '../src/components/themed-text';
import { setOnboardingComplete } from '../src/lib/onboarding-storage';
import { useAppTheme } from '../src/theme/use-app-theme';

const SLIDE_WIDTH = Dimensions.get('window').width;

type OnboardingSlide = {
  readonly body: string;
  readonly id: string;
  readonly title: string;
};

const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'purpose',
    title: 'Independent IT guidance',
    body: 'TechMD Advisory helps you cut through vendor noise and delivery risk with structured, vendor-neutral advice for growing businesses in the Philippines.',
  },
  {
    id: 'how',
    title: 'How you use the app',
    body: 'Start a guided diagnostic to describe your situation, answer focused questions, and get a clear recommendation. When you are ready, book a remote session from the home screen.',
  },
  {
    id: 'start',
    title: 'You are set',
    body: 'Use the home tab to explore common situations, book time, or open a new diagnostic any time from the + button below.',
  },
] as const;

/**
 * First-run intro carousel; skip or finish persists until app data is cleared.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const isLastSlide = slideIndex >= ONBOARDING_SLIDES.length - 1;
  const executeFinish = useCallback(async (): Promise<void> => {
    await setOnboardingComplete();
    router.replace('/(tabs)');
  }, [router]);
  const executeSkip = useCallback(() => {
    void executeFinish();
  }, [executeFinish]);
  const executePrimary = useCallback(() => {
    if (isLastSlide) {
      void executeFinish();
      return;
    }
    const nextIndex = slideIndex + 1;
    listRef.current?.scrollToOffset({ animated: true, offset: nextIndex * SLIDE_WIDTH });
    setSlideIndex(nextIndex);
  }, [executeFinish, isLastSlide, slideIndex]);
  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const x = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(x / SLIDE_WIDTH);
    setSlideIndex(Math.max(0, Math.min(nextIndex, ONBOARDING_SLIDES.length - 1)));
  }, []);
  const renderSlide: ListRenderItem<OnboardingSlide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: SLIDE_WIDTH }]}>
        <ThemedText style={[styles.slideTitle, { color: theme.text }]}>{item.title}</ThemedText>
        <ThemedText style={[styles.slideBody, { color: theme.textMuted }]}>{item.body}</ThemedText>
      </View>
    ),
    [theme.text, theme.textMuted],
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Skip introduction" accessibilityRole="button" hitSlop={12} onPress={executeSkip}>
          <ThemedText style={[styles.skipLabel, { color: theme.primary }]}>Skip</ThemedText>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        data={[...ONBOARDING_SLIDES]}
        getItemLayout={(_, index) => ({
          index,
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
        })}
        horizontal
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onMomentumScrollEnd}
        pagingEnabled
        renderItem={renderSlide}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
      />
      <View style={styles.dots}>
        {ONBOARDING_SLIDES.map((slide, index) => (
          <View
            key={slide.id}
            style={[
              styles.dot,
              {
                backgroundColor: index === slideIndex ? theme.primary : theme.border,
                width: index === slideIndex ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <AppButton
          iconName={isLastSlide ? 'rocket-outline' : 'arrow-forward-outline'}
          onPress={executePrimary}
          showTrailingIcon
        >
          {isLastSlide ? "Let's start" : 'Next'}
        </AppButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  topBar: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  skipLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    flexGrow: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  slideBody: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  dot: {
    borderRadius: 999,
    height: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 16,
  },
});
