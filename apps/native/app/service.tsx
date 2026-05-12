import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useAppTheme } from '../src/theme/use-app-theme';

const INCLUDED_ITEMS = [
  'Review of the current situation, stakeholders, and constraints',
  'Identification of delivery risks and likely root causes',
  'Decision checkpoints and options ranked by impact versus effort',
  'Vendor or systems-integrator dynamics to challenge or formalize',
  'A 90-day stabilization roadmap outline',
] as const;

/**
 * Static service-detail screen for the first native release.
 */
export default function ServiceScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <AppScreen
      title="Project Rescue Consultation"
      subtitle="A focused working session for leaders who need independent judgment when timelines slip or scope churns."
      footer={
        <View style={styles.footerGroup}>
          <AppButton onPress={() => router.push('/booking')}>Book this session</AppButton>
          <AppButton onPress={() => router.back()} variant="secondary">
            Back
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>What is included</Text>
        {INCLUDED_ITEMS.map((item) => (
          <View key={item} style={styles.row}>
            <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
            <Text style={[styles.bodyText, { color: theme.text }]}>{item}</Text>
          </View>
        ))}
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Commercial snapshot</Text>
        <Text style={[styles.priceLabel, { color: theme.textMuted }]}>Investment</Text>
        <Text style={[styles.priceValue, { color: theme.text }]}>From PHP 6,000</Text>
        <Text style={[styles.bodyText, { color: theme.textMuted }]}>Per session, delivered remotely by default.</Text>
        <Text style={[styles.priceLabel, { color: theme.textMuted }]}>Duration</Text>
        <Text style={[styles.bodyText, { color: theme.text }]}>60-90 minutes</Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
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
