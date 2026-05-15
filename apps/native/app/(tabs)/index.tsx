import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppCard } from '../../src/components/app-card';
import { AppScreen } from '../../src/components/app-screen';
import { ThemedText } from '../../src/components/themed-text';
import { useAppTheme } from '../../src/theme/use-app-theme';

const PROBLEM_ITEMS = [
  {
    icon: 'warning-outline' as const,
    title: 'Project is delayed or failing',
    description: 'Get clarity on delivery risk, ownership gaps, and the fastest path to stabilization.',
  },
  {
    icon: 'git-branch-outline' as const,
    title: 'Requirements keep changing',
    description: 'Turn scope churn into a clearer decision path before more budget is consumed.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Leadership wants an independent view',
    description: 'Bring a neutral technical advisor into high-stakes software or vendor decisions.',
  },
] as const;

const STEP_ITEMS = [
  'Describe the situation in plain language.',
  'Answer focused multiple-choice follow-up questions.',
  'Get a tailored recommendation and book a session.',
] as const;

/**
 * Home tab: overview, how it works, and common situations (account lives under Profile).
 */
export default function HomeTabScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <AppScreen
      subtitle="Independent, vendor-neutral IT guidance for growing businesses in the Philippines."
      title="Solve the right technology problem."
      usesBottomTabBar
    >
      <AppCard tone="brand">
        <ThemedText style={[styles.eyebrow, { color: theme.onPrimaryMuted }]}>How it works</ThemedText>
        <View style={styles.stepList}>
          {STEP_ITEMS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepBadge, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                <ThemedText style={[styles.stepBadgeText, { color: theme.onPrimary }]}>{index + 1}</ThemedText>
              </View>
              <ThemedText style={[styles.stepText, { color: theme.onPrimary }]}>{step}</ThemedText>
            </View>
          ))}
        </View>
      </AppCard>
      <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Common situations</ThemedText>
      {PROBLEM_ITEMS.map((item) => (
        <Pressable
          key={item.title}
          accessibilityRole="button"
          onPress={() => router.push('/diagnostic')}
          style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}
        >
          <AppCard>
            <View style={styles.situationRow}>
              <View style={[styles.situationIconWrap, { backgroundColor: theme.primarySoft }]}>
                <Ionicons color={theme.primary} name={item.icon} size={22} />
              </View>
              <View style={styles.situationCopy}>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>{item.title}</ThemedText>
                <ThemedText style={[styles.cardBody, { color: theme.textMuted }]}>{item.description}</ThemedText>
              </View>
              <Ionicons color={theme.textSoft} name="chevron-forward" size={22} style={styles.situationChevron} />
            </View>
          </AppCard>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stepList: {
    gap: 16,
    marginTop: 18,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  stepBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  situationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  situationIconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  situationCopy: {
    flex: 1,
    gap: 6,
  },
  situationChevron: {
    opacity: 0.85,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  cardBody: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
});
