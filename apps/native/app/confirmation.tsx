import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ThemedText } from '../src/components/themed-text';
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
  const params = useLocalSearchParams<{ date?: string; time?: string; meetingUrl?: string | string[] }>();
  const { executeReset } = useDiagnosticFlow();
  const hasResetRef = useRef<boolean>(false);
  const displayDate = formatDisplayDate(params.date);
  const displayTime = params.time ?? 'your selected time';
  const rawMeetingParam = params.meetingUrl;
  const meetingUrlFromParams =
    typeof rawMeetingParam === 'string'
      ? rawMeetingParam.trim()
      : Array.isArray(rawMeetingParam) && typeof rawMeetingParam[0] === 'string'
        ? rawMeetingParam[0].trim()
        : '';
  const meetingUrl = meetingUrlFromParams.length > 0 ? meetingUrlFromParams : null;

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
      subtitle={
        meetingUrl !== null
          ? 'Your booking is confirmed. Use the meeting link below or check your email for the same join URL.'
          : 'Your consultation slot is reserved. Check your email for confirmation and meeting details.'
      }
      footer={
        <View style={styles.footerGroup}>
          <AppButton iconName="home-outline" onPress={() => router.replace('/(tabs)')} showTrailingIcon>
            Back to home
          </AppButton>
          <AppButton iconName="sparkles-outline" onPress={() => router.replace('/diagnostic')} variant="secondary">
            Run another diagnostic
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Booking summary</ThemedText>
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>When</ThemedText>
          <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{displayDate}</ThemedText>
          <ThemedText style={[styles.summaryMeta, { color: theme.textMuted }]}>{displayTime} · {PRIMARY_TIMEZONE}</ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>Format</ThemedText>
          <ThemedText style={[styles.summaryValue, { color: theme.text }]}>Video call</ThemedText>
          {meetingUrl !== null ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open video meeting"
              onPress={() => {
                void Linking.openURL(meetingUrl);
              }}
              style={({ pressed }) => [styles.joinLink, { opacity: pressed ? 0.85 : 1 }]}
            >
              <ThemedText style={[styles.joinLinkText, { color: theme.primary }]}>Open meeting</ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={[styles.summaryMeta, { color: theme.textMuted }]}>
              The join link is sent by email after payment is confirmed.
            </ThemedText>
          )}
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
  joinLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  joinLinkText: {
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
