import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useDiagnosticFlow } from '../src/providers/diagnostic-flow-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const BENEFITS = [
  '60-90 minute focused session',
  'Independent, vendor-neutral guidance',
  'Actionable recommendations you can execute this quarter',
  'Concise summary notes after the call',
] as const;

/**
 * Recommendation screen shown after the guided diagnostic completes.
 */
export default function RecommendationScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { guided } = useDiagnosticFlow();

  useEffect(() => {
    if (guided.outcome === null) {
      router.replace('/diagnostic');
    }
  }, [guided.outcome, router]);

  if (guided.outcome === null) {
    return null;
  }

  return (
    <AppScreen
      title="Recommended for you"
      subtitle="Your answers point to a high-leverage advisory session before more time or budget is spent."
      footer={
        <View style={styles.footerGroup}>
          <AppButton onPress={() => router.push('/service')}>View details and book</AppButton>
          <AppButton onPress={() => router.push('/diagnostic')} variant="secondary">
            Review answers
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.serviceTitle, { color: theme.text }]}>Project Rescue Consultation</Text>
        <Text style={[styles.serviceBody, { color: theme.textMuted }]}>
          A structured working session to stabilize delivery, clarify decisions, and reduce continued spend on the wrong path.
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.badgeText, { color: theme.primary }]}>{guided.outcome.mappedSituation}</Text>
        </View>
        <Text style={[styles.summaryText, { color: theme.textMuted }]}>{guided.outcome.advisorSummary}</Text>
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>What you get</Text>
        {BENEFITS.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
            <Text style={[styles.benefitText, { color: theme.text }]}>{benefit}</Text>
          </View>
        ))}
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  serviceTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
  },
  serviceBody: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  bullet: {
    borderRadius: 999,
    height: 10,
    marginTop: 7,
    width: 10,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
});
