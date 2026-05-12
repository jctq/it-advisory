import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useDiagnosticFlow } from '../src/providers/diagnostic-flow-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const PRIMARY_TIMEZONE = 'Asia/Manila';

function formatDisplayDate(isoDate: string | undefined): string {
  if (isoDate === undefined || isoDate.length === 0) {
    return 'your selected date';
  }
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Booking confirmation screen for the sample native booking flow.
 */
export default function ConfirmationScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ date?: string; time?: string }>();
  const { executeReset } = useDiagnosticFlow();
  const hasResetRef = useRef<boolean>(false);
  const displayDate = formatDisplayDate(params.date);
  const displayTime = params.time ?? 'your selected time';

  useEffect((): void => {
    if (hasResetRef.current) {
      return;
    }
    hasResetRef.current = true;
    void executeReset({ shouldNotify: false });
  }, [executeReset]);

  return (
    <AppScreen
      title="You're all set"
      subtitle="Your consultation slot is reserved. Email and calendar automation can be connected next."
      footer={
        <View style={styles.footerGroup}>
          <AppButton onPress={() => router.replace('/')}>Back to home</AppButton>
          <AppButton onPress={() => router.replace('/diagnostic')} variant="secondary">
            Run another diagnostic
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Booking summary</Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>When</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{displayDate}</Text>
          <Text style={[styles.summaryMeta, { color: theme.textMuted }]}>{displayTime} · {PRIMARY_TIMEZONE}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Format</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>Remote video call</Text>
          <Text style={[styles.summaryMeta, { color: theme.textMuted }]}>Meeting link can be sent when email delivery is wired.</Text>
        </View>
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
  summaryRow: {
    marginTop: 18,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: 6,
  },
  summaryMeta: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
});
