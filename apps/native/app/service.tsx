import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  PROJECT_RESCUE_BOOKING_FOOTNOTE,
  PROJECT_RESCUE_PRICE_HEADLINE,
  PROJECT_RESCUE_SERVICE_TITLE,
  PROJECT_RESCUE_SESSION_DURATION,
  PROJECT_RESCUE_WHATS_INCLUDED,
  resolveProjectRescueBriefAssessment,
  resolveProjectRescueGoodFitBullets,
  resolveProjectRescueSessionTitle,
} from '@it-advisory/diagnostic-core/project-rescue-service-context';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useDiagnosticFlow } from '../src/providers/diagnostic-flow-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

/**
 * Static service-detail screen for the first native release.
 */
export default function ServiceScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { guided } = useDiagnosticFlow();
  const outcome = guided.outcome;
  const advisorSummary = outcome?.advisorSummary?.trim() ?? '';
  const mappedSituation = outcome?.mappedSituation?.trim() ?? '';
  const goodFitBullets = resolveProjectRescueGoodFitBullets(outcome?.goodFitBullets ?? null);

  return (
    <AppScreen
      title={resolveProjectRescueSessionTitle(outcome?.sessionTitle)}
      subtitle={resolveProjectRescueBriefAssessment(outcome?.briefAssessment)}
      footer={
        <View style={styles.footerGroup}>
          <AppButton onPress={() => router.push('/booking')}>Book this session</AppButton>
          <AppButton onPress={() => router.back()} variant="secondary">
            Back
          </AppButton>
        </View>
      }
    >
      {advisorSummary.length > 0 ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your advisor summary</Text>
          <Text style={[styles.hintText, { color: theme.textMuted }]}>
            From your guided diagnostic — useful context for your booking.
          </Text>
          {mappedSituation.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{mappedSituation}</Text>
            </View>
          ) : null}
          <Text style={[styles.summaryText, { color: theme.textMuted }]}>{advisorSummary}</Text>
        </AppCard>
      ) : null}
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>What is included</Text>
        {PROJECT_RESCUE_WHATS_INCLUDED.map((item) => (
          <View key={item} style={styles.row}>
            <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
            <Text style={[styles.bodyText, { color: theme.text }]}>{item}</Text>
          </View>
        ))}
      </AppCard>
      <AppCard>
        <Text style={[styles.goodFitHeading, { color: theme.textMuted }]}>Good fit if</Text>
        {goodFitBullets.map((line, index) => (
          <View key={`gf-${index}`} style={styles.row}>
            <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
            <Text style={[styles.goodFitLine, { color: theme.textMuted }]}>{line}</Text>
          </View>
        ))}
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Commercial snapshot</Text>
        <Text style={[styles.priceLabel, { color: theme.textMuted }]}>Investment</Text>
        <Text style={[styles.priceValue, { color: theme.text }]}>{PROJECT_RESCUE_PRICE_HEADLINE}</Text>
        <Text style={[styles.bodyText, { color: theme.textMuted }]}>{PROJECT_RESCUE_BOOKING_FOOTNOTE}</Text>
        <Text style={[styles.priceLabel, { color: theme.textMuted }]}>Duration</Text>
        <Text style={[styles.bodyText, { color: theme.text }]}>{PROJECT_RESCUE_SESSION_DURATION}</Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    marginTop: 14,
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
  goodFitHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  goodFitLine: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  row: {
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
  bodyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 6,
  },
});
