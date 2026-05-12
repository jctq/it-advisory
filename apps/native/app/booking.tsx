import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, format } from 'date-fns';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useAppTheme } from '../src/theme/use-app-theme';

const TIME_SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'] as const;
const PRIMARY_TIMEZONE = 'Asia/Manila';

/**
 * Lightweight booking screen for the first native release.
 */
export default function BookingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [selectedDate, setSelectedDate] = useState<string | null>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedTime, setSelectedTime] = useState<string | null>('11:00 AM');
  const dateOptions = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(new Date(), index + 1)), []);

  return (
    <AppScreen
      title="Choose a date and time"
      subtitle={`Available sample slots in Philippine Time (${PRIMARY_TIMEZONE}).`}
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            disabled={selectedDate === null || selectedTime === null}
            onPress={() => {
              if (selectedDate === null || selectedTime === null) {
                return;
              }
              router.push({
                pathname: '/confirmation',
                params: {
                  date: selectedDate,
                  time: selectedTime,
                },
              });
            }}
          >
            Confirm booking
          </AppButton>
          <AppButton onPress={() => router.back()} variant="secondary">
            Back
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Select a date</Text>
        <View style={styles.grid}>
          {dateOptions.map((date) => {
            const isoDate = format(date, 'yyyy-MM-dd');
            const isSelected = selectedDate === isoDate;
            return (
              <Pressable
                key={isoDate}
                accessibilityRole="button"
                onPress={() => setSelectedDate(isoDate)}
                style={({ pressed }) => [
                  styles.choiceButton,
                  {
                    backgroundColor: isSelected ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: isSelected ? theme.primary : theme.border,
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <Text style={[styles.choiceTitle, { color: theme.text }]}>{format(date, 'EEE')}</Text>
                <Text style={[styles.choiceBody, { color: theme.textMuted }]}>{format(date, 'MMM d')}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Select a time</Text>
        <View style={styles.grid}>
          {TIME_SLOTS.map((slot) => {
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
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <Text style={[styles.choiceTitle, { color: theme.text }]}>{slot}</Text>
                <Text style={[styles.choiceBody, { color: theme.textMuted }]}>{PRIMARY_TIMEZONE}</Text>
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
    fontSize: 18,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  choiceButton: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 76,
    minWidth: '47%',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  choiceBody: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
});
