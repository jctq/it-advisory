import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';
import * as Linking from 'expo-linking';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';

type CalendarLinkThemeSlice = {
  readonly border: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly primary: string;
  readonly textMuted: string;
};

export type AddToCalendarLinkRowProps = {
  readonly startsAtIso: string;
  readonly title: string;
  readonly description: string;
  readonly location?: string;
  readonly icsUidSeed: string;
  readonly theme: CalendarLinkThemeSlice;
};

/**
 * Opens vendor calendar compose screens; ICS is offered via the same data URL pattern as web.
 */
export function AddToCalendarLinkRow(props: AddToCalendarLinkRowProps): ReactElement {
  const startsAtUtc = new Date(props.startsAtIso);
  const location = props.location?.trim() ?? '';
  const bundle = buildBookingCalendarLinkBundle({
    title: props.title,
    description: props.description,
    location,
    startsAtUtc,
    durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
    icsUidSeed: props.icsUidSeed,
  });
  const executeOpen = async (url: string): Promise<void> => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.label, { color: props.theme.textMuted }]}>Add to calendar</ThemedText>
      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void executeOpen(bundle.googleCalendarUrl);
          }}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: props.theme.border, backgroundColor: pressed ? props.theme.surfaceMuted : props.theme.surface },
          ]}
        >
          <ThemedText style={[styles.chipText, { color: props.theme.primary }]}>Google</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void executeOpen(bundle.outlookCalendarUrl);
          }}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: props.theme.border, backgroundColor: pressed ? props.theme.surfaceMuted : props.theme.surface },
          ]}
        >
          <ThemedText style={[styles.chipText, { color: props.theme.primary }]}>Outlook</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void executeOpen(bundle.icsDataUrl);
          }}
          style={({ pressed }) => [
            styles.chip,
            { borderColor: props.theme.border, backgroundColor: pressed ? props.theme.surfaceMuted : props.theme.surface },
          ]}
        >
          <ThemedText style={[styles.chipText, { color: props.theme.primary }]}>Apple (.ics)</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
