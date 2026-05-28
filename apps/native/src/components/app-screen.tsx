import type { PropsWithChildren, ReactNode } from 'react';
import { useRef } from 'react';
import { Platform, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { BlurView, type ExperimentalBlurMethod } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Edge } from 'react-native-safe-area-context';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSupportReportScreenCapture } from '../providers/support-report-provider';
import { useAppTheme } from '../theme/use-app-theme';
import { ThemedText } from './themed-text';

const ORB_BLUR_INTENSITY = 72;
const ANDROID_ORB_BLUR_METHOD: ExperimentalBlurMethod = 'dimezisBlurView';

const CONTENT_PADDING_BOTTOM = 28;
/** Matches compact `AppTabBar` content height. */
const TAB_BAR_SURFACE_HEIGHT = 52;
const TAB_BAR_SCROLL_GAP = 12;
/** Tighter gap above the tab bar when the footer strip is compact and transparent. */
const TAB_BAR_SCROLL_GAP_COMPACT_FOOTER = 8;
const FULL_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom'];
const TAB_SCREEN_SAFE_AREA_EDGES: readonly Edge[] = ['top', 'left', 'right'];

type AppScreenProps = PropsWithChildren<{
  readonly footer?: ReactNode;
  /** Tighter vertical padding around the sticky footer row. */
  readonly footerCompact?: boolean;
  readonly subtitle?: string;
  readonly title: string;
  /**
   * When false, the body is a flex column instead of a ScrollView.
   * Use with an inner FlatList/ScrollView so nested scroll gestures stay reliable.
   */
  readonly contentScrollEnabled?: boolean;
  /** When true, omits bottom safe-area padding (tab bar applies it) and uses tighter scroll bottom padding. */
  readonly usesBottomTabBar?: boolean;
}>;

type BlurredOrbProps = {
  readonly accentColor: string;
  readonly blurTint: 'dark' | 'light';
  readonly style: {
    readonly borderRadius: number;
    readonly height: number;
    readonly left?: number;
    readonly position: 'absolute';
    readonly right?: number;
    readonly top: number;
    readonly width: number;
  };
  /** Translucent wash on top of blur; parent views must stay at opacity 1 for native blur to work. */
  readonly tintOpacity: number;
};

function BlurredOrb(props: BlurredOrbProps) {
  const experimentalBlurMethod: ExperimentalBlurMethod =
    Platform.OS === 'android' ? ANDROID_ORB_BLUR_METHOD : 'none';
  return (
    <View style={[props.style, styles.orbClip]} pointerEvents="none">
      <BlurView
        blurReductionFactor={Platform.OS === 'android' ? 3 : 4}
        experimentalBlurMethod={experimentalBlurMethod}
        intensity={ORB_BLUR_INTENSITY}
        style={StyleSheet.absoluteFillObject}
        tint={props.blurTint}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: props.accentColor, opacity: props.tintOpacity },
        ]}
      />
    </View>
  );
}

/**
 * Safe-area aware screen shell with scroll body and optional sticky footer.
 */
export function AppScreen(props: AppScreenProps) {
  const theme = useAppTheme();
  const screenCaptureRef = useRef<View>(null);
  useSupportReportScreenCapture(screenCaptureRef);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const blurTint: 'dark' | 'light' = colorScheme === 'dark' ? 'dark' : 'light';
  const usesBottomTabBar: boolean = props.usesBottomTabBar === true;
  const contentScrollEnabled: boolean = props.contentScrollEnabled !== false;
  const footerCompact: boolean = props.footerCompact === true;
  const safeAreaEdges: readonly Edge[] = usesBottomTabBar ? TAB_SCREEN_SAFE_AREA_EDGES : FULL_SAFE_AREA_EDGES;
  const tabBarContentBottomInset: number =
    TAB_BAR_SURFACE_HEIGHT + TAB_BAR_SCROLL_GAP + Math.max(insets.bottom, 8);
  const resolvedContentBottomPadding: number = contentScrollEnabled
    ? usesBottomTabBar
      ? tabBarContentBottomInset
      : CONTENT_PADDING_BOTTOM
    : usesBottomTabBar && props.footer !== undefined
      ? 8
      : usesBottomTabBar
        ? tabBarContentBottomInset
        : CONTENT_PADDING_BOTTOM;
  const footerBottomPadding: number = usesBottomTabBar
    ? TAB_BAR_SURFACE_HEIGHT +
      (footerCompact ? TAB_BAR_SCROLL_GAP_COMPACT_FOOTER : TAB_BAR_SCROLL_GAP) +
      Math.max(insets.bottom, 8)
    : 20;
  const contentPaddingStyle = {
    paddingBottom: resolvedContentBottomPadding,
  };

  return (
    <SafeAreaView
      ref={screenCaptureRef}
      collapsable={false}
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={safeAreaEdges}
    >
      <LinearGradient
        colors={[theme.background, theme.backgroundGradientEnd]}
        end={{ x: 0.92, y: 1 }}
        start={{ x: 0.08, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.decorLayer} pointerEvents="none">
        <BlurredOrb
          accentColor={theme.primarySoft}
          blurTint={blurTint}
          style={styles.decorOrbLarge}
          tintOpacity={0.52}
        />
        <BlurredOrb
          accentColor={theme.primarySoft}
          blurTint={blurTint}
          style={styles.decorOrbSmall}
          tintOpacity={0.38}
        />
      </View>
      <View style={styles.container}>
        {contentScrollEnabled ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentPaddingStyle]}
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            <ThemedText style={[styles.title, { color: theme.text }]}>{props.title}</ThemedText>
            {props.subtitle !== undefined ? (
              <ThemedText style={[styles.subtitle, { color: theme.textMuted }]}>{props.subtitle}</ThemedText>
            ) : null}
            {props.children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.bodyNoScroll]}>
            <View style={[styles.content, styles.bodyNoScrollGrow, contentPaddingStyle]}>
              <ThemedText style={[styles.title, { color: theme.text }]}>{props.title}</ThemedText>
              {props.subtitle !== undefined ? (
                <ThemedText style={[styles.subtitle, { color: theme.textMuted }]}>{props.subtitle}</ThemedText>
              ) : null}
              {props.children}
            </View>
          </View>
        )}
        {props.footer !== undefined ? (
          <View
            style={[
              styles.footer,
              footerCompact ? styles.footerCompact : null,
              footerCompact ? styles.footerCompactVisual : null,
              {
                backgroundColor: footerCompact ? 'transparent' : theme.surface,
                borderTopColor: theme.border,
                paddingBottom: footerBottomPadding,
                shadowColor: '#0A0618',
              },
            ]}
          >
            {props.footer}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  decorLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orbClip: {
    overflow: 'hidden',
  },
  decorOrbLarge: {
    borderRadius: 999,
    height: 320,
    left: -80,
    position: 'absolute',
    top: -120,
    width: 320,
  },
  decorOrbSmall: {
    borderRadius: 999,
    height: 200,
    position: 'absolute',
    right: -70,
    top: 110,
    width: 200,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  bodyNoScroll: {
    minHeight: 0,
  },
  bodyNoScrollGrow: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: 20,
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: -8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 12,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  footerCompact: {
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  /** Compact footers sit over the scene gradient — no tray shadow or opaque fill. */
  footerCompactVisual: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});
