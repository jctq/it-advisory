import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { addDays, format } from 'date-fns';
import { getBookingAvailabilitySlots, fetchMarketingServerClockOffsetMs } from '@techmd/api-client/marketing-booking-api-client';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ThemedText } from '../src/components/themed-text';
import { useAppTheme } from '../src/theme/use-app-theme';

const PRIMARY_TIMEZONE = 'Asia/Manila';
const DEFAULT_SERVICE_KEY = 'project-rescue' as const;

function groupSlotsByDate(slots: readonly { date: string; time: string }[]): Readonly<Record<string, readonly string[]>> {
  const map: Record<string, string[]> = {};
  for (const row of slots) {
    const existing = map[row.date];
    if (existing === undefined) {
      map[row.date] = [row.time];
    } else {
      existing.push(row.time);
    }
  }
  for (const key of Object.keys(map)) {
    const list = map[key];
    if (list !== undefined) {
      list.sort();
    }
  }
  return map;
}

/**
 * Lightweight booking screen for the first native release.
 */
export default function BookingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  const [dateOptionDates, setDateOptionDates] = useState<readonly Date[]>([]);
  const [availabilityByDate, setAvailabilityByDate] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  useEffect(() => {
    if (apiBaseUrl.length === 0) {
      setLoadStatus('error');
      setLoadError('Set EXPO_PUBLIC_API_BASE_URL to your web API origin.');
      return;
    }
    const controller = new AbortController();
    setLoadStatus('loading');
    setLoadError(null);
    setDateOptionDates([]);
    void (async () => {
      const offset = await fetchMarketingServerClockOffsetMs({
        apiBaseUrl,
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      const anchorMs = offset !== null ? Date.now() + offset : Date.now();
      const options = Array.from({ length: 7 }, (_, index) => addDays(new Date(anchorMs), index + 1));
      setDateOptionDates(options);
      const fromYmd = format(options[0]!, 'yyyy-MM-dd');
      const toYmd = format(options[options.length - 1]!, 'yyyy-MM-dd');
      try {
        const slots = await getBookingAvailabilitySlots({
          apiBaseUrl,
          fromYmd,
          toYmd,
          serviceKey: DEFAULT_SERVICE_KEY,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setAvailabilityByDate(groupSlotsByDate(slots));
        setLoadStatus('ready');
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        setLoadStatus('error');
        setLoadError(error instanceof Error ? error.message : 'Failed to load availability');
      }
    })();
    return () => {
      controller.abort();
    };
  }, [apiBaseUrl]);
  useEffect(() => {
    if (loadStatus !== 'ready') {
      return;
    }
    if (selectedDate !== null) {
      return;
    }
    const firstWithSlots = dateOptionDates.find((d) => (availabilityByDate[format(d, 'yyyy-MM-dd')]?.length ?? 0) > 0);
    if (firstWithSlots !== undefined) {
      setSelectedDate(format(firstWithSlots, 'yyyy-MM-dd'));
    }
  }, [loadStatus, selectedDate, dateOptionDates, availabilityByDate]);
  useEffect(() => {
    if (selectedDate === null) {
      setSelectedTime(null);
      return;
    }
    const times = availabilityByDate[selectedDate] ?? [];
    setSelectedTime((previous) => {
      if (times.length === 0) {
        return null;
      }
      if (previous !== null && times.includes(previous)) {
        return previous;
      }
      return times[0] ?? null;
    });
  }, [selectedDate, availabilityByDate]);
  const slotsForSelected = selectedDate !== null ? availabilityByDate[selectedDate] ?? [] : [];
  return (
    <AppScreen
      title="Choose a date and time"
      subtitle={`Open slots in Philippine Time (${PRIMARY_TIMEZONE}).`}
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            disabled={
              selectedDate === null ||
              selectedTime === null ||
              loadStatus === 'loading' ||
              (loadStatus === 'ready' && slotsForSelected.length === 0)
            }
            iconName="checkmark-circle-outline"
            onPress={() => {
              if (selectedDate === null || selectedTime === null) {
                return;
              }
              router.push({
                pathname: '/booking-details',
                params: {
                  date: selectedDate,
                  time: selectedTime,
                },
              });
            }}
            showTrailingIcon
          >
            Confirm booking
          </AppButton>
          <AppButton iconName="arrow-back-outline" onPress={() => router.back()} variant="secondary">
            Back
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Select a date</ThemedText>
        {loadStatus === 'loading' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textMuted }]}>Loading open days…</ThemedText>
          </View>
        ) : null}
        {loadStatus === 'error' && loadError !== null ? (
          <ThemedText style={[styles.errorText, { color: theme.danger }]}>{loadError}</ThemedText>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.dateStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {dateOptionDates.map((date) => {
            const isoDate = format(date, 'yyyy-MM-dd');
            const slotCount = availabilityByDate[isoDate]?.length ?? 0;
            const isEmpty = loadStatus === 'ready' && slotCount === 0;
            const isSelected = selectedDate === isoDate;
            return (
              <Pressable
                key={isoDate}
                accessibilityRole="button"
                disabled={isEmpty}
                onPress={() => {
                  if (!isEmpty) {
                    setSelectedDate(isoDate);
                  }
                }}
                style={({ pressed }) => [
                  styles.dateChip,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surfaceMuted,
                    borderColor: isSelected ? 'transparent' : theme.border,
                    borderWidth: isSelected ? 0 : StyleSheet.hairlineWidth,
                    opacity: isEmpty ? 0.4 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <ThemedText style={[styles.choiceTitle, { color: isSelected ? theme.onPrimary : theme.text }]}>
                  {format(date, 'EEE')}
                </ThemedText>
                <ThemedText style={[styles.choiceBody, { color: isSelected ? theme.onPrimaryMuted : theme.textMuted }]}>
                  {format(date, 'MMM d')}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </AppCard>
      <AppCard>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Select a time</ThemedText>
        {loadStatus === 'ready' && slotsForSelected.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>No times for this day.</ThemedText>
        ) : null}
        <View style={styles.grid}>
          {slotsForSelected.map((slot) => {
            const isSelected = selectedTime === slot;
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                onPress={() => setSelectedTime(slot)}
                style={({ pressed }) => [
                  styles.choiceButton,
                  {
                    backgroundColor: isSelected ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <ThemedText style={[styles.choiceTitle, { color: theme.text }]}>{slot}</ThemedText>
                <ThemedText style={[styles.choiceBody, { color: theme.textMuted }]}>{PRIMARY_TIMEZONE}</ThemedText>
              </Pressable>
            );
          })}
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
    fontSize: 17,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  dateStrip: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingBottom: 4,
    paddingRight: 4,
  },
  dateChip: {
    alignItems: 'center',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 76,
    minWidth: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  choiceButton: {
    borderRadius: 20,
    minHeight: 76,
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  choiceBody: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
});
