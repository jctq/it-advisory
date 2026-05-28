import {
  fetchMarketingMyReportById,
  postMarketingMyReportReply,
  type MarketingSupportReportDetail,
  type MarketingSupportReportReply,
  type MarketingSupportReportReplyPolicy,
} from '@techmd/api-client/marketing-my-reports-api-client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppButton } from '../../src/components/app-button';
import { AppCard } from '../../src/components/app-card';
import { AppScreen } from '../../src/components/app-screen';
import { ThemedText } from '../../src/components/themed-text';
import { readNativeAppConfig } from '../../src/lib/native-app-config';
import { useMarketingAuth } from '../../src/providers/marketing-auth-provider';
import { useAppTheme } from '../../src/theme/use-app-theme';

type ChatBubbleRole = 'user' | 'staff' | 'attachment';

type ChatBubble = {
  readonly id: string;
  readonly role: ChatBubbleRole;
  readonly label: string;
  readonly body: string | null;
  readonly createdAtIso: string;
};

function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatCooldownLabel(seconds: number): string {
  if (seconds >= 60) {
    return `${Math.ceil(seconds / 60)} min`;
  }
  return `${seconds}s`;
}

function buildChatBubbles(report: MarketingSupportReportDetail): readonly ChatBubble[] {
  const bubbles: ChatBubble[] = [
    {
      id: `report-${report.id}`,
      role: 'user',
      label: 'You',
      body: report.message,
      createdAtIso: report.createdAtIso,
    },
  ];
  if (report.hasScreenshot) {
    bubbles.push({
      id: `screenshot-${report.id}`,
      role: 'attachment',
      label: 'You',
      body: null,
      createdAtIso: report.createdAtIso,
    });
  }
  for (const reply of report.replies) {
    bubbles.push(mapReplyToBubble(reply));
  }
  return bubbles;
}

function mapReplyToBubble(reply: MarketingSupportReportReply): ChatBubble {
  return {
    id: reply.id,
    role: reply.isStaffReply ? 'staff' : 'user',
    label: reply.isStaffReply ? 'Support team' : 'You',
    body: reply.message,
    createdAtIso: reply.createdAtIso,
  };
}

function ChatBubbleView(props: {
  readonly bubble: ChatBubble;
  readonly screenshotUri: string | null;
  readonly authHeader: string | undefined;
}): ReactElement {
  const theme = useAppTheme();
  const isUser = props.bubble.role === 'user';
  const isStaff = props.bubble.role === 'staff';
  if (props.bubble.role === 'attachment' && props.screenshotUri !== null) {
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowEnd]}>
        <View style={[styles.bubbleColumn, styles.bubbleColumnEnd]}>
          <View style={styles.bubbleMetaRow}>
            <ThemedText style={[styles.bubbleAuthor, { color: theme.text }]}>{props.bubble.label}</ThemedText>
            <ThemedText style={[styles.bubbleTime, { color: theme.textMuted }]}>
              {formatReportDate(props.bubble.createdAtIso)}
            </ThemedText>
          </View>
          <Image
            accessibilityLabel="Report screenshot"
            resizeMode="contain"
            source={{
              uri: props.screenshotUri,
              headers: props.authHeader !== undefined ? { Authorization: props.authHeader } : undefined,
            }}
            style={[styles.screenshot, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowEnd : styles.bubbleRowStart]}>
      <View style={[styles.bubbleColumn, isUser ? styles.bubbleColumnEnd : styles.bubbleColumnStart]}>
        <View style={styles.bubbleMetaRow}>
          <ThemedText style={[styles.bubbleAuthor, { color: isUser ? theme.onPrimary : theme.text }]}>
            {props.bubble.label}
          </ThemedText>
          <ThemedText style={[styles.bubbleTime, { color: isUser ? theme.onPrimaryMuted : theme.textMuted }]}>
            {formatReportDate(props.bubble.createdAtIso)}
          </ThemedText>
        </View>
        {props.bubble.body !== null ? (
          <View
            style={[
              styles.bubbleBody,
              {
                backgroundColor: isUser ? theme.primary : isStaff ? theme.primarySoft : theme.surfaceMuted,
                borderColor: isUser ? theme.primary : isStaff ? theme.primary : theme.border,
              },
            ]}
          >
            <ThemedText style={{ color: isUser ? theme.onPrimary : theme.text, lineHeight: 20 }}>
              {props.bubble.body}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Support report detail as a chat thread with throttled follow-up replies.
 */
export default function AccountReportDetailScreen(): ReactElement {
  const theme = useAppTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const config = useMemo(() => readNativeAppConfig(), []);
  const { deviceId, sessionToken, user } = useMarketingAuth();
  const params = useLocalSearchParams<{ readonly reportId?: string }>();
  const reportId = typeof params.reportId === 'string' ? params.reportId : '';
  const [report, setReport] = useState<MarketingSupportReportDetail | null>(null);
  const [replyPolicy, setReplyPolicy] = useState<MarketingSupportReportReplyPolicy | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useEffect(() => {
    if (user === null) {
      router.replace('/login');
      return;
    }
    if (deviceId === null || sessionToken === null || reportId.length === 0) {
      setError('Could not load this report.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    void fetchMarketingMyReportById({
      apiBaseUrl: config.apiBaseUrl,
      deviceId,
      marketingSessionToken: sessionToken,
      reportId,
    })
      .then((loaded) => {
        setReport(loaded.report);
        setReplyPolicy(loaded.replyPolicy);
        setCooldownSeconds(loaded.replyPolicy.cooldownRemainingSeconds);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load report.');
      })
      .finally(() => setIsLoading(false));
  }, [config.apiBaseUrl, deviceId, reportId, router, sessionToken, user]);
  const screenshotUri =
    report !== null && report.hasScreenshot
      ? `${config.apiBaseUrl.replace(/\/$/, '')}/api/support/my-reports/${encodeURIComponent(report.id)}/screenshot`
      : null;
  const authHeader = sessionToken !== null ? `Bearer ${sessionToken}` : undefined;
  const chatBubbles = report !== null ? buildChatBubbles(report) : [];
  const hasStaffReply = report !== null && report.replies.some((reply) => reply.isStaffReply);
  const canSend =
    replyPolicy !== null &&
    replyPolicy.allowReporterFollowUpReplies &&
    replyPolicy.canReply &&
    cooldownSeconds <= 0 &&
    draftMessage.trim().length > 0 &&
    !isSubmitting;
  useEffect(() => {
    if (chatBubbles.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timeoutId);
  }, [chatBubbles.length]);
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }
    const intervalId = setInterval(() => {
      setCooldownSeconds((previous) => (previous <= 1 ? 0 : previous - 1));
    }, 1000);
    return () => clearInterval(intervalId);
  }, [cooldownSeconds]);
  const executeSubmitFollowUp = (): void => {
    if (deviceId === null || sessionToken === null || report === null || !canSend) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    void postMarketingMyReportReply({
      apiBaseUrl: config.apiBaseUrl,
      deviceId,
      marketingSessionToken: sessionToken,
      reportId: report.id,
      message: draftMessage.trim(),
    })
      .then((result) => {
        setReport(result.report);
        setReplyPolicy(result.replyPolicy);
        setCooldownSeconds(result.replyPolicy.cooldownRemainingSeconds);
        setDraftMessage('');
      })
      .catch((submitError: unknown) => {
        setSubmitError(submitError instanceof Error ? submitError.message : 'Failed to send message.');
      })
      .finally(() => setIsSubmitting(false));
  };
  return (
    <AppScreen contentScrollEnabled={false} title="Report conversation">
      {isLoading ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText style={{ color: theme.textMuted, marginLeft: 12 }}>Loading…</ThemedText>
        </View>
      ) : error !== null || report === null || replyPolicy === null ? (
        <AppCard>
          <ThemedText style={{ color: theme.danger }}>{error ?? 'Report not found.'}</ThemedText>
          <View style={styles.backButton}>
            <AppButton variant="secondary" onPress={() => router.back()}>
              Back
            </AppButton>
          </View>
        </AppCard>
      ) : (
        <View style={[styles.chatShell, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={[styles.chatHeader, { borderBottomColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
            <ThemedText style={[styles.route, { color: theme.textMuted }]}>{report.route}</ThemedText>
            <ThemedText style={[styles.statusLine, { color: hasStaffReply ? theme.primary : theme.textMuted }]}>
              {hasStaffReply ? 'Support has replied' : 'Awaiting support reply'}
            </ThemedText>
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator
            style={styles.chatScroll}
          >
            {chatBubbles.map((bubble) => (
              <ChatBubbleView
                key={bubble.id}
                authHeader={authHeader}
                bubble={bubble}
                screenshotUri={screenshotUri}
              />
            ))}
          </ScrollView>
          <View style={[styles.chatFooter, { borderTopColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
            {!replyPolicy.allowReporterFollowUpReplies ? (
              <ThemedText style={[styles.footerText, { color: theme.textMuted }]}>
                Follow-up messages are disabled for support reports right now.
              </ThemedText>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Follow-up message"
                  editable={!isSubmitting && cooldownSeconds <= 0}
                  multiline
                  onChangeText={setDraftMessage}
                  placeholder="Add a follow-up message…"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.composeInput,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.surface,
                      color: theme.text,
                    },
                  ]}
                  value={draftMessage}
                />
                {submitError !== null ? (
                  <ThemedText style={[styles.errorText, { color: theme.danger }]}>{submitError}</ThemedText>
                ) : null}
                {cooldownSeconds > 0 ? (
                  <ThemedText style={[styles.footerText, { color: theme.textMuted }]}>
                    You can send again in {formatCooldownLabel(cooldownSeconds)}.
                  </ThemedText>
                ) : (
                  <ThemedText style={[styles.footerText, { color: theme.textMuted }]}>
                    Up to {replyPolicy.maxPerHour} follow-ups per hour · wait at least{' '}
                    {formatCooldownLabel(replyPolicy.minIntervalSeconds)} between messages.
                  </ThemedText>
                )}
                <AppButton disabled={!canSend} onPress={executeSubmitFollowUp}>
                  {isSubmitting ? 'Sending…' : 'Send message'}
                </AppButton>
              </>
            )}
            <AppButton variant="secondary" onPress={() => router.back()}>
              Back to reports
            </AppButton>
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 24,
  },
  backButton: {
    marginTop: 16,
  },
  chatShell: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chatHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  route: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  statusLine: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    gap: 14,
    padding: 16,
    paddingBottom: 24,
  },
  chatFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
    padding: 16,
  },
  composeInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 88,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
  },
  bubbleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  bubbleRowStart: {
    justifyContent: 'flex-start',
  },
  bubbleRowEnd: {
    justifyContent: 'flex-end',
  },
  bubbleColumn: {
    gap: 6,
    maxWidth: '88%',
  },
  bubbleColumnStart: {
    alignItems: 'flex-start',
  },
  bubbleColumnEnd: {
    alignItems: 'flex-end',
  },
  bubbleMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubbleAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  bubbleTime: {
    fontSize: 11,
  },
  bubbleBody: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  screenshot: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    height: 220,
    width: '100%',
  },
});
