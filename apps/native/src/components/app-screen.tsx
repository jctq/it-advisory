import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/use-app-theme';

type AppScreenProps = PropsWithChildren<{
  readonly footer?: ReactNode;
  readonly subtitle?: string;
  readonly title: string;
}>;

/**
 * Safe-area aware screen shell with scrollable content and optional sticky footer.
 */
export function AppScreen(props: AppScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <Text style={[styles.title, { color: theme.text }]}>{props.title}</Text>
          {props.subtitle !== undefined ? (
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{props.subtitle}</Text>
          ) : null}
          {props.children}
        </ScrollView>
        {props.footer !== undefined ? (
          <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
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
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: -6,
  },
  footer: {
    borderTopWidth: 1,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
});
