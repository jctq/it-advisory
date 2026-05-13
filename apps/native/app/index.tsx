import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useMarketingAuth } from '../src/providers/marketing-auth-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const PROBLEM_ITEMS = [
  {
    title: 'Project is delayed or failing',
    description: 'Get clarity on delivery risk, ownership gaps, and the fastest path to stabilization.',
  },
  {
    title: 'Requirements keep changing',
    description: 'Turn scope churn into a clearer decision path before more budget is consumed.',
  },
  {
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
 * Native home screen for the public advisory funnel.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, executeLogout } = useMarketingAuth();

  return (
    <AppScreen
      title="Solve the right technology problem."
      subtitle="Independent, vendor-neutral IT guidance for growing businesses in the Philippines."
      footer={
        <View style={styles.footerGroup}>
          <AppButton onPress={() => router.push('/diagnostic')}>Start guided diagnostic</AppButton>
          <AppButton onPress={() => router.push('/booking')} variant="secondary">
            Book a session
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>How it works</Text>
        <View style={styles.stepList}>
          {STEP_ITEMS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepBadge, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.stepBadgeText, { color: theme.primary }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
            </View>
          ))}
        </View>
      </AppCard>
      <AppCard>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Account</Text>
        <Text style={[styles.accountHint, { color: theme.textMuted }]}>
          {`Signing in is optional. Use it to attach this device's diagnostic to your email.`}
        </Text>
        {user === null ? (
          <View style={styles.accountActions}>
            <AppButton onPress={() => router.push('/login')} variant="secondary">
              Sign in
            </AppButton>
            <AppButton onPress={() => router.push('/register')} variant="ghost">
              Create account
            </AppButton>
          </View>
        ) : (
          <View style={styles.accountActions}>
            <Text style={[styles.signedInEmail, { color: theme.text }]}>{user.email}</Text>
            <AppButton
              onPress={() => {
                void executeLogout().catch(() => {});
              }}
              variant="secondary"
            >
              Sign out
            </AppButton>
          </View>
        )}
      </AppCard>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Common situations</Text>
      {PROBLEM_ITEMS.map((item) => (
        <Pressable
          key={item.title}
          accessibilityRole="button"
          onPress={() => router.push('/diagnostic')}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          <AppCard>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.cardBody, { color: theme.textMuted }]}>{item.description}</Text>
          </AppCard>
        </Pressable>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
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
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  accountHint: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  accountActions: {
    gap: 10,
    marginTop: 16,
  },
  signedInEmail: {
    fontSize: 15,
    fontWeight: '700',
  },
});
