import { DiagnosticApiClient } from '@techmd/api-client/diagnostic-api-client';
import {
  GUIDED_DIAGNOSTIC_EMPTY,
  parseGuidedDiagnosticJson,
  type GuidedDiagnosticV1,
} from '@techmd/diagnostic-core/guided-diagnostic-types';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppButton } from '../../src/components/app-button';
import { AddToCalendarLinkRow } from '../../src/components/add-to-calendar-link-row';
import { AppCard } from '../../src/components/app-card';
import { AppScreen } from '../../src/components/app-screen';
import { ThemedText } from '../../src/components/themed-text';
import { normalizeGuidedDiagnosticRaw } from '../../src/lib/diagnostic-flow';
import { readNativeAppConfig } from '../../src/lib/native-app-config';
import { useMarketingAuth } from '../../src/providers/marketing-auth-provider';
import { useAppTheme } from '../../src/theme/use-app-theme';

type LinkedBookingSlot = {
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
};

function buildGuidedFromAnswers(answers: Record<string, unknown> | undefined): GuidedDiagnosticV1 {
  if (answers === undefined) {
    return GUIDED_DIAGNOSTIC_EMPTY;
  }
  const rawGuided = answers.guidedDiagnostic;
  const normalized = normalizeGuidedDiagnosticRaw(rawGuided);
  if (normalized === undefined || normalized.length === 0) {
    return GUIDED_DIAGNOSTIC_EMPTY;
  }
  return parseGuidedDiagnosticJson(normalized) ?? GUIDED_DIAGNOSTIC_EMPTY;
}

function readStringAnswer(answers: Record<string, unknown> | undefined, key: string): string | null {
  if (answers === undefined) {
    return null;
  }
  const value = answers[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Read-only view of one diagnostic session linked to the signed-in account.
 */
export default function DiagnosticSessionDetailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ sessionRef?: string | string[] }>();
  const rawRef = params.sessionRef;
  const config = useMemo(() => readNativeAppConfig(), []);
  const { deviceId, sessionToken } = useMarketingAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, unknown> | undefined>(undefined);
  const [linkedBookingSlot, setLinkedBookingSlot] = useState<LinkedBookingSlot | null>(null);

  useEffect(() => {
    const resolvedRef = Array.isArray(rawRef) ? rawRef[0] : rawRef;
    if (resolvedRef === undefined || resolvedRef.length === 0) {
      setErrorMessage('Missing session reference.');
      setIsLoading(false);
      return;
    }
    if (deviceId === null || sessionToken === null) {
      setErrorMessage('Sign in to view this session.');
      setIsLoading(false);
      return;
    }
    const stableDeviceId = deviceId;
    const stableSessionToken = sessionToken;
    const stableSessionRef: string = resolvedRef;
    let isCancelled = false;
    async function load(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const client = new DiagnosticApiClient({
          apiOrigin: config.apiBaseUrl,
          deviceId: stableDeviceId,
          marketingSessionToken: stableSessionToken,
        });
        const payload = await client.fetchQuizSessionBySessionRef(stableSessionRef);
        if (isCancelled) {
          return;
        }
        if (payload.session === null) {
          setAnswers(undefined);
          setCurrentStep(0);
          setReadOnly(Boolean(payload.readOnly));
          setLinkedBookingSlot(null);
          setErrorMessage('This session could not be found for your account.');
        } else {
          setAnswers(payload.session.answers as Record<string, unknown>);
          setCurrentStep(payload.session.currentStep);
          setReadOnly(Boolean(payload.readOnly));
          const rawSlot = (payload as { linkedBookingSlot?: unknown }).linkedBookingSlot;
          if (
            rawSlot !== null &&
            typeof rawSlot === 'object' &&
            rawSlot !== undefined &&
            'startsAtIso' in rawSlot &&
            typeof (rawSlot as { startsAtIso?: unknown }).startsAtIso === 'string' &&
            'timezone' in rawSlot &&
            typeof (rawSlot as { timezone?: unknown }).timezone === 'string' &&
            'serviceKey' in rawSlot &&
            typeof (rawSlot as { serviceKey?: unknown }).serviceKey === 'string' &&
            'status' in rawSlot &&
            typeof (rawSlot as { status?: unknown }).status === 'string'
          ) {
            const meetingUrlRaw = (rawSlot as { meetingUrl?: unknown }).meetingUrl;
            const meetingUrl =
              typeof meetingUrlRaw === 'string' && meetingUrlRaw.trim().length > 0 ? meetingUrlRaw.trim() : null;
            setLinkedBookingSlot({
              status: (rawSlot as { status: 'pending' | 'confirmed' | 'cancelled' }).status,
              startsAtIso: (rawSlot as { startsAtIso: string }).startsAtIso,
              timezone: (rawSlot as { timezone: string }).timezone,
              serviceKey: (rawSlot as { serviceKey: string }).serviceKey,
              meetingUrl,
            });
          } else {
            setLinkedBookingSlot(null);
          }
        }
      } catch (error: unknown) {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load session.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      isCancelled = true;
    };
  }, [config.apiBaseUrl, deviceId, rawRef, sessionToken]);

  const guided = useMemo(() => buildGuidedFromAnswers(answers), [answers]);
  const situationFromAnswers = useMemo(() => readStringAnswer(answers, 'situation'), [answers]);
  const mappedFromOutcome = guided.outcome?.mappedSituation?.trim() ?? '';
  const advisorSummary = guided.outcome?.advisorSummary?.trim() ?? '';
  const sessionTitle = guided.outcome?.sessionTitle?.trim() ?? '';
  const headline =
    sessionTitle.length > 0
      ? sessionTitle
      : mappedFromOutcome.length > 0
        ? mappedFromOutcome
        : situationFromAnswers ?? 'Diagnostic session';
  const calendarTitle =
    linkedBookingSlot?.serviceKey === 'project-rescue'
      ? PROJECT_RESCUE_SERVICE_TITLE
      : linkedBookingSlot?.serviceKey ?? 'Consultation';
  const slotLabel =
    linkedBookingSlot !== null
      ? new Intl.DateTimeFormat('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: linkedBookingSlot.timezone,
        }).format(new Date(linkedBookingSlot.startsAtIso))
      : null;
  const calendarThemeSlice = {
    border: theme.border,
    surface: theme.surface,
    surfaceMuted: theme.surfaceMuted,
    primary: theme.primary,
    textMuted: theme.textMuted,
  };
  return (
    <AppScreen
      subtitle="Saved answers and summary for this diagnostic."
      title="Session details"
      footer={
        <AppButton iconName="chevron-back-outline" onPress={() => router.back()} variant="secondary">
          Back
        </AppButton>
      }
    >
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : null}
      {errorMessage !== null ? (
        <AppCard>
          <ThemedText style={{ color: theme.danger, fontWeight: '600' }}>{errorMessage}</ThemedText>
        </AppCard>
      ) : null}
      {!isLoading && errorMessage === null && answers !== undefined ? (
        <>
          <AppCard>
            <ThemedText style={[styles.kicker, { color: theme.textMuted }]}>Status</ThemedText>
            <ThemedText style={[styles.body, { color: theme.text }]}>
              Step {currentStep}
              {readOnly ? ' · read-only' : ''}
            </ThemedText>
            {guided.outcome === null ? (
              <ThemedText style={[styles.body, { color: theme.textMuted, marginTop: 8 }]}>Diagnostic not finalized yet.</ThemedText>
            ) : null}
          </AppCard>
          {linkedBookingSlot !== null && linkedBookingSlot.status !== 'cancelled' && slotLabel !== null ? (
            <AppCard>
              <ThemedText style={[styles.kicker, { color: theme.textMuted }]}>Booked session</ThemedText>
              <ThemedText style={[styles.body, { color: theme.text }]}>{slotLabel}</ThemedText>
              <ThemedText style={[styles.body, { color: theme.textMuted, marginTop: 4, fontSize: 13 }]}>
                {linkedBookingSlot.timezone} · {linkedBookingSlot.status}
              </ThemedText>
              {linkedBookingSlot.status === 'confirmed' ? (
                <AddToCalendarLinkRow
                  startsAtIso={linkedBookingSlot.startsAtIso}
                  title={calendarTitle}
                  description="Booked consultation from your TechMD diagnostic."
                  location={linkedBookingSlot.meetingUrl ?? undefined}
                  icsUidSeed={linkedBookingSlot.startsAtIso}
                  theme={calendarThemeSlice}
                />
              ) : null}
              {linkedBookingSlot.status === 'confirmed' && linkedBookingSlot.meetingUrl !== null ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Open video meeting"
                  onPress={() => {
                    void Linking.openURL(linkedBookingSlot.meetingUrl!);
                  }}
                  style={({ pressed }) => [{ marginTop: 12, opacity: pressed ? 0.85 : 1 }]}
                >
                  <ThemedText style={{ color: theme.primary, fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' }}>
                    Open meeting
                  </ThemedText>
                </Pressable>
              ) : null}
            </AppCard>
          ) : null}
          <AppCard>
            <ThemedText style={[styles.kicker, { color: theme.textMuted }]}>Situation</ThemedText>
            <ThemedText style={[styles.body, { color: theme.text }]}>{headline}</ThemedText>
            {guided.initialPrompt.trim().length > 0 ? (
              <>
                <ThemedText style={[styles.kicker, { color: theme.textMuted, marginTop: 14 }]}>Your prompt</ThemedText>
                <ThemedText style={[styles.body, { color: theme.text }]}>{guided.initialPrompt.trim()}</ThemedText>
              </>
            ) : null}
            {advisorSummary.length > 0 ? (
              <>
                <ThemedText style={[styles.kicker, { color: theme.textMuted, marginTop: 14 }]}>Advisor summary</ThemedText>
                <ThemedText style={[styles.body, { color: theme.text }]}>{advisorSummary}</ThemedText>
              </>
            ) : null}
          </AppCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 6,
  },
});
