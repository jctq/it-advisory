import { fetchMarketingMyDiagnosticSessions, type MarketingDiagnosticSessionSummary } from '@techmd/api-client/marketing-my-diagnostics-api-client';
import { fetchMarketingMyReportsUnreadCount } from '@techmd/api-client/marketing-my-reports-api-client';
import { PROJECT_RESCUE_SERVICE_TITLE } from '@techmd/diagnostic-core/project-rescue-service-context';
import {
  buildPhilippineMobileE164FromNationalDigits,
  normalizePhilippineMobileNationalDigits,
  parseNationalDigitsFromStoredPhone,
} from '@techmd/domain/philippine-mobile-phone';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppButton } from '../../src/components/app-button';
import { AddToCalendarLinkRow } from '../../src/components/add-to-calendar-link-row';
import { AppCard } from '../../src/components/app-card';
import { AppScreen } from '../../src/components/app-screen';
import { ProfileReportsTab } from '../../src/components/profile-reports-tab';
import { useSupportModuleEnabled } from '../../src/hooks/use-support-module-enabled';
import { ThemedText } from '../../src/components/themed-text';
import { readNativeAppConfig } from '../../src/lib/native-app-config';
import { useMarketingAuth } from '../../src/providers/marketing-auth-provider';
import { useAppTheme } from '../../src/theme/use-app-theme';

const DIAGNOSTIC_LIST_PAGE_SIZE = 12;

type ProfileTabId = 'profile' | 'diagnostics' | 'reports';

function formatDiagnosticPrimaryStatus(row: MarketingDiagnosticSessionSummary): string {
  return row.completedAtIso !== null ? 'Completed' : 'In progress';
}

function formatBookingStatusLine(row: MarketingDiagnosticSessionSummary): string | null {
  if (!row.isBooked) {
    return null;
  }
  if (row.bookingStatus === 'confirmed') {
    return 'Booking: confirmed';
  }
  if (row.bookingStatus === 'cancelled') {
    return 'Booking: cancelled';
  }
  if (row.bookingStatus === 'pending') {
    return 'Booking: pending';
  }
  return 'Booking: linked';
}

function formatSessionTitle(row: MarketingDiagnosticSessionSummary): string {
  const title = row.sessionTitlePreview?.trim();
  if (title !== undefined && title.length > 0) {
    return title.length > 72 ? `${title.slice(0, 69)}…` : title;
  }
  const preview = row.situationPreview?.trim();
  if (preview !== undefined && preview.length > 0) {
    return preview.length > 72 ? `${preview.slice(0, 69)}…` : preview;
  }
  return 'Diagnostic session';
}

const MONGO_OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

function buildNativeBookManageUrl(apiBaseUrl: string, bookingId: string | null): string {
  const origin = apiBaseUrl.replace(/\/$/, '');
  if (bookingId !== null && MONGO_OBJECT_ID_HEX.test(bookingId)) {
    return `${origin}/book/manage?bookingId=${encodeURIComponent(bookingId)}`;
  }
  return `${origin}/book/manage`;
}

/**
 * Profile tab: sign-in when logged out; profile form and diagnostic history when signed in.
 */
export default function ProfileTabScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const config = useMemo(() => readNativeAppConfig(), []);
  const { user, sessionToken, deviceId, executeLogout, executePatchProfile } = useMarketingAuth();
  const [activeTab, setActiveTab] = useState<ProfileTabId>('profile');
  const [fullName, setFullName] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [phoneNationalDigits, setPhoneNationalDigits] = useState<string>('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [sessions, setSessions] = useState<readonly MarketingDiagnosticSessionSummary[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState<boolean>(false);
  const [sessionsPage, setSessionsPage] = useState<number>(1);
  const [sessionsTotalPages, setSessionsTotalPages] = useState<number>(0);
  const [sessionsTotalCount, setSessionsTotalCount] = useState<number>(0);
  const [reportsUnreadCount, setReportsUnreadCount] = useState<number>(0);
  const supportModuleEnabled = useSupportModuleEnabled();
  const diagnosticsAppendInFlightRef = useRef<boolean>(false);
  const profileTabs = useMemo<readonly ProfileTabId[]>(() => {
    const tabs: ProfileTabId[] = ['profile', 'diagnostics'];
    if (supportModuleEnabled) {
      tabs.push('reports');
    }
    return tabs;
  }, [supportModuleEnabled]);

  useEffect(() => {
    if (user === null) {
      return;
    }
    setFullName(user.fullName ?? '');
    setCompany(user.company ?? '');
    setPhoneNationalDigits(parseNationalDigitsFromStoredPhone(user.phone));
  }, [user]);

  useEffect(() => {
    if (!supportModuleEnabled && activeTab === 'reports') {
      setActiveTab('profile');
    }
  }, [activeTab, supportModuleEnabled]);

  const loadSessions = useCallback(
    async (options: { readonly page: number; readonly append: boolean }): Promise<void> => {
      if (deviceId === null || sessionToken === null) {
        return;
      }
      setSessionsError(null);
      if (options.append) {
        setIsLoadingMoreSessions(true);
      } else {
        setIsLoadingSessions(true);
      }
      try {
        const page = await fetchMarketingMyDiagnosticSessions({
          apiBaseUrl: config.apiBaseUrl,
          deviceId,
          marketingSessionToken: sessionToken,
          page: options.page,
          pageSize: DIAGNOSTIC_LIST_PAGE_SIZE,
          status: 'all',
        });
        setSessionsPage(page.page);
        setSessionsTotalPages(page.totalPages);
        setSessionsTotalCount(page.totalCount);
        setSessions((previous) => (options.append ? [...previous, ...page.sessions] : page.sessions));
      } catch (error: unknown) {
        setSessionsError(error instanceof Error ? error.message : 'Could not load sessions.');
      } finally {
        setIsLoadingSessions(false);
        setIsLoadingMoreSessions(false);
      }
    },
    [config.apiBaseUrl, deviceId, sessionToken],
  );

  useEffect(() => {
    if (user === null || activeTab !== 'diagnostics') {
      return;
    }
    diagnosticsAppendInFlightRef.current = false;
    void loadSessions({ page: 1, append: false });
  }, [user, activeTab, loadSessions]);

  const loadReportsUnreadCount = useCallback(async (): Promise<void> => {
    if (!supportModuleEnabled || user === null || deviceId === null || sessionToken === null) {
      setReportsUnreadCount(0);
      return;
    }
    try {
      const unreadCount = await fetchMarketingMyReportsUnreadCount({
        apiBaseUrl: config.apiBaseUrl,
        deviceId,
        marketingSessionToken: sessionToken,
      });
      setReportsUnreadCount(unreadCount);
    } catch {
      // Ignore badge polling errors.
    }
  }, [config.apiBaseUrl, deviceId, sessionToken, supportModuleEnabled, user]);

  useFocusEffect(
    useCallback(() => {
      void loadReportsUnreadCount();
    }, [loadReportsUnreadCount]),
  );

  const handleDiagnosticsEndReached = useCallback(() => {
    if (sessionsError !== null) {
      return;
    }
    if (isLoadingSessions || isLoadingMoreSessions || diagnosticsAppendInFlightRef.current) {
      return;
    }
    if (sessionsTotalPages <= 0 || sessionsPage >= sessionsTotalPages) {
      return;
    }
    diagnosticsAppendInFlightRef.current = true;
    void loadSessions({ page: sessionsPage + 1, append: true }).finally(() => {
      diagnosticsAppendInFlightRef.current = false;
    });
  }, [
    isLoadingMoreSessions,
    isLoadingSessions,
    loadSessions,
    sessionsError,
    sessionsPage,
    sessionsTotalPages,
  ]);

  const renderDiagnosticSessionRow = useCallback(
    ({ item }: { readonly item: MarketingDiagnosticSessionSummary }) => {
      const bookingLine = formatBookingStatusLine(item);
      const hasBookedSlot =
        item.bookingStartsAtIso !== null &&
        item.bookingTimezone !== null &&
        item.bookingStatus !== null &&
        item.bookingStatus !== 'cancelled';
      const showCalendarLinks = item.bookingStatus === 'confirmed';
      const slotLabel =
        hasBookedSlot === true
          ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: item.bookingTimezone!,
            }).format(new Date(item.bookingStartsAtIso!))
          : null;
      const calendarTitle =
        item.bookingServiceKey === 'project-rescue'
          ? PROJECT_RESCUE_SERVICE_TITLE
          : item.bookingServiceKey ?? 'Consultation';
      const calendarThemeSlice = {
        border: theme.border,
        surface: theme.surface,
        surfaceMuted: theme.surfaceMuted,
        primary: theme.primary,
        textMuted: theme.textMuted,
      };
      const openDiagnosticSession = (): void => {
        router.push({
          pathname: '/diagnostic-session/[sessionRef]',
          params: { sessionRef: item.marketingSessionRef },
        });
      };
      const openBookManage = (): void => {
        void Linking.openURL(buildNativeBookManageUrl(config.apiBaseUrl, item.bookingId));
      };
      return (
        <View
          style={[
            styles.sessionRowWrap,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <View style={styles.sessionRowInner}>
            <ThemedText style={[styles.sessionTitle, { color: theme.text }]}>{formatSessionTitle(item)}</ThemedText>
            <ThemedText style={[styles.sessionMeta, { color: theme.textMuted }]}>
              {formatDiagnosticPrimaryStatus(item)}
              {bookingLine !== null ? ` · ${bookingLine}` : ''}
            </ThemedText>
            <View style={styles.sessionActionsRow}>
              <View style={styles.sessionActionSlot}>
                <AppButton compact variant="secondary" onPress={openDiagnosticSession}>
                  {item.isBooked ? 'View' : 'Continue'}
                </AppButton>
              </View>
              {item.isBooked ? (
                <View style={styles.sessionActionSlot}>
                  <AppButton compact onPress={openBookManage}>
                    Manage
                  </AppButton>
                </View>
              ) : null}
            </View>
          </View>
          {hasBookedSlot && slotLabel !== null ? (
            <View style={[styles.sessionCalendarSection, { borderTopColor: theme.border }]}>
              <ThemedText style={[styles.sessionSlotLabel, { color: theme.textMuted }]}>{slotLabel}</ThemedText>
              {showCalendarLinks ? (
                <AddToCalendarLinkRow
                  startsAtIso={item.bookingStartsAtIso!}
                  title={calendarTitle}
                  description={
                    item.bookingReferenceId !== null
                      ? `Booking reference ${item.bookingReferenceId}. Native diagnostics.`
                      : 'Native diagnostics.'
                  }
                  location={item.bookingMeetingUrl ?? undefined}
                  icsUidSeed={item.bookingReferenceId ?? item.bookingStartsAtIso!}
                  theme={calendarThemeSlice}
                />
              ) : null}
              {item.bookingStatus === 'confirmed' && item.bookingMeetingUrl !== null && item.bookingMeetingUrl.length > 0 ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Open video meeting"
                  onPress={() => {
                    void Linking.openURL(item.bookingMeetingUrl!);
                  }}
                  style={({ pressed }) => [styles.sessionJoinZoom, { opacity: pressed ? 0.88 : 1 }]}
                >
                  <ThemedText style={[styles.sessionJoinZoomText, { color: theme.primary }]}>Open meeting</ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    [config.apiBaseUrl, router, theme.border, theme.primary, theme.surface, theme.surfaceMuted, theme.text, theme.textMuted],
  );

  const accountFooter: ReactNode =
    user !== null && activeTab === 'profile' ? (
      <View style={styles.profileFooterRow}>
        <View style={styles.profileFooterButtonSlot}>
          <AppButton
            busy={isSavingProfile}
            compact
            disabled={fullName.trim().length < 2 || buildPhilippineMobileE164FromNationalDigits(phoneNationalDigits) === null}
            onPress={() => {
              setProfileError(null);
              const phoneE164 = buildPhilippineMobileE164FromNationalDigits(phoneNationalDigits);
              if (phoneE164 === null) {
                setProfileError('Enter a valid Philippine mobile number.');
                return;
              }
              setIsSavingProfile(true);
              void executePatchProfile({
                email: user.email,
                fullName: fullName.trim(),
                company: company.trim(),
                phone: phoneE164,
              })
                .catch((error: unknown) => {
                  setProfileError(error instanceof Error ? error.message : 'Could not save profile.');
                })
                .finally(() => {
                  setIsSavingProfile(false);
                });
            }}
          >
            Save
          </AppButton>
        </View>
        <View style={styles.profileFooterButtonSlot}>
          <AppButton
            compact
            onPress={() => {
              void executeLogout().catch(() => {});
            }}
            variant="ghost"
          >
            Sign out
          </AppButton>
        </View>
      </View>
    ) : undefined;

  const isAccountFooterVisible: boolean = user !== null && activeTab === 'profile';

  return (
    <AppScreen
      contentScrollEnabled={user === null}
      footer={accountFooter}
      footerCompact={isAccountFooterVisible}
      subtitle={user === null ? 'Optional — attach this device diagnostic to your email.' : 'Manage your account and past diagnostics.'}
      title="Profile"
      usesBottomTabBar
    >
      {user === null ? (
        <AppCard>
          <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
            Signing in lets you sync guided diagnostics and pick up where you left off across sessions.
          </ThemedText>
          <View style={styles.actions}>
            <AppButton iconName="log-in-outline" onPress={() => router.push('/login')} variant="secondary">
              Sign in
            </AppButton>
            <AppButton onPress={() => router.push('/register')} variant="ghost">
              Create account
            </AppButton>
            <AppButton
              iconName="calendar-outline"
              onPress={() => {
                void Linking.openURL(buildNativeBookManageUrl(config.apiBaseUrl, null));
              }}
              variant="secondary"
            >
              Manage booking
            </AppButton>
          </View>
        </AppCard>
      ) : (
        <View style={styles.signedInFill}>
          <View style={[styles.segmentRow, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            {profileTabs.map((tabId) => {
              const isActive = activeTab === tabId;
              const tabLabel =
                tabId === 'profile' ? 'Account' : tabId === 'diagnostics' ? 'Diagnostics' : 'Reports';
              return (
                <Pressable
                  key={tabId}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveTab(tabId)}
                  style={[
                    styles.segmentChip,
                    isActive ? { backgroundColor: theme.surface } : null,
                    isActive
                      ? {
                          borderColor: theme.border,
                          shadowColor: '#0A0618',
                        }
                      : null,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.segmentLabel,
                      { color: isActive ? theme.text : theme.textMuted },
                    ]}
                  >
                    {tabLabel}
                  </ThemedText>
                  {tabId === 'reports' && reportsUnreadCount > 0 ? (
                    <View style={[styles.segmentBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText style={[styles.segmentBadgeLabel, { color: theme.onPrimary }]}>
                        {reportsUnreadCount > 9 ? '9+' : String(reportsUnreadCount)}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {activeTab === 'profile' ? (
            <ScrollView
              contentContainerStyle={styles.accountScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={styles.accountScroll}
            >
              <AppCard>
              <ThemedText style={[styles.fieldLabel, { color: theme.text }]}>Full name</ThemedText>
              <TextInput
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.text,
                  },
                ]}
                value={fullName}
              />
              <ThemedText style={[styles.fieldLabel, { color: theme.text, marginTop: 10 }]}>Email</ThemedText>
              <TextInput
                editable={false}
                style={[
                  styles.input,
                  styles.inputReadonly,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.textMuted,
                  },
                ]}
                value={user.email}
              />
              <ThemedText style={[styles.fieldLabel, { color: theme.text, marginTop: 10 }]}>Company</ThemedText>
              <TextInput
                onChangeText={setCompany}
                placeholder="Company or organization"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.text,
                  },
                ]}
                value={company}
              />
              <ThemedText style={[styles.fieldLabel, { color: theme.text, marginTop: 10 }]}>Phone (PH)</ThemedText>
              <ThemedText style={[styles.fieldHint, { color: theme.textMuted }]}>
                Saved as +63; leading 0 is dropped (09… → 9…).
              </ThemedText>
              <View
                style={[
                  styles.phoneRow,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                  },
                ]}
              >
                <ThemedText style={[styles.phonePrefix, { color: theme.textMuted }]}>+63</ThemedText>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={(text) => {
                    setPhoneNationalDigits(normalizePhilippineMobileNationalDigits(text));
                  }}
                  placeholder="9xx xxx xxxx"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.phoneInput, { color: theme.text }]}
                  value={phoneNationalDigits}
                />
              </View>
              {profileError !== null ? (
                <ThemedText style={[styles.error, { color: theme.danger }]}>{profileError}</ThemedText>
              ) : null}
              </AppCard>
              <View style={styles.manageBookingSection}>
                <ThemedText style={[styles.fieldHint, { color: theme.textMuted }]}>
                  Opens the website to pay, check status, or update a booking using your reference, email, and phone last
                  four.
                </ThemedText>
                <AppButton
                  compact
                  iconName="open-outline"
                  onPress={() => {
                    void Linking.openURL(buildNativeBookManageUrl(config.apiBaseUrl, null));
                  }}
                  variant="secondary"
                >
                  Manage booking
                </AppButton>
              </View>
            </ScrollView>
          ) : activeTab === 'reports' ? (
            deviceId !== null && sessionToken !== null ? (
              <ProfileReportsTab
                apiBaseUrl={config.apiBaseUrl}
                deviceId={deviceId}
                sessionToken={sessionToken}
              />
            ) : null
          ) : (
            <AppCard fillVertical>
              <View style={styles.diagnosticsCardColumn}>
                <FlatList
                  contentContainerStyle={styles.diagnosticsListContent}
                  data={sessions as MarketingDiagnosticSessionSummary[]}
                  keyExtractor={(row: MarketingDiagnosticSessionSummary) => row.id}
                  ListEmptyComponent={
                    !isLoadingSessions && sessionsError === null ? (
                      <ThemedText style={{ color: theme.textMuted }}>No diagnostic sessions yet.</ThemedText>
                    ) : null
                  }
                  ListHeaderComponent={
                    <View>
                      {isLoadingSessions && sessions.length === 0 ? (
                        <View style={styles.loaderRow}>
                          <ActivityIndicator color={theme.primary} />
                          <ThemedText style={{ color: theme.textMuted, marginLeft: 12 }}>Loading sessions…</ThemedText>
                        </View>
                      ) : null}
                      {sessionsError !== null ? (
                        <ThemedText style={[styles.error, { color: theme.danger }]}>{sessionsError}</ThemedText>
                      ) : null}
                      <View style={styles.diagnosticsManageBookingRow}>
                        <ThemedText style={[styles.fieldHint, { color: theme.textMuted }]}>
                          Need the web flow (reference + verification)? Open manage booking.
                        </ThemedText>
                        <AppButton
                          compact
                          iconName="open-outline"
                          onPress={() => {
                            void Linking.openURL(buildNativeBookManageUrl(config.apiBaseUrl, null));
                          }}
                          variant="secondary"
                        >
                          Manage booking
                        </AppButton>
                      </View>
                    </View>
                  }
                  onEndReached={handleDiagnosticsEndReached}
                  onEndReachedThreshold={0.35}
                  renderItem={renderDiagnosticSessionRow}
                  showsVerticalScrollIndicator
                  style={styles.diagnosticsFlatList}
                />
                {sessions.length > 0 ? (
                  <View
                    style={[
                      styles.diagnosticsListFooter,
                      {
                        borderTopColor: theme.border,
                        marginHorizontal: -2,
                      },
                    ]}
                  >
                    {isLoadingMoreSessions ? (
                      <View style={styles.diagnosticsFooterLoader}>
                        <ActivityIndicator color={theme.primary} size="small" />
                      </View>
                    ) : null}
                    <ThemedText style={[styles.listSummaryFooter, { color: theme.textMuted }]}>
                      Showing {sessions.length} of {sessionsTotalCount} session{sessionsTotalCount === 1 ? '' : 's'}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </AppCard>
          )}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  signedInFill: {
    flex: 1,
    gap: 14,
    minHeight: 0,
  },
  accountScroll: {
    flex: 1,
    minHeight: 0,
  },
  accountScrollContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  segmentRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    padding: 3,
  },
  segmentChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  segmentBadge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
  segmentBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 3,
  },
  input: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  phoneRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 6,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 6,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    paddingVertical: 10,
    paddingRight: 6,
  },
  inputReadonly: {
    opacity: 0.85,
  },
  profileFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  profileFooterButtonSlot: {
    flex: 1,
    minWidth: 0,
  },
  profileFooterDivider: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  loaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  diagnosticsCardColumn: {
    flex: 1,
    minHeight: 0,
  },
  diagnosticsListFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  diagnosticsFooterLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  listSummaryFooter: {
    fontSize: 13,
    fontWeight: '500',
  },
  diagnosticsFlatList: {
    flex: 1,
    marginHorizontal: -2,
    minHeight: 0,
  },
  diagnosticsListContent: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  manageBookingSection: {
    gap: 10,
    marginTop: 14,
  },
  diagnosticsManageBookingRow: {
    gap: 8,
    marginBottom: 6,
    marginTop: 12,
  },
  sessionRowWrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    overflow: 'hidden',
  },
  sessionRowInner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sessionActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sessionActionSlot: {
    flex: 1,
    minWidth: 0,
  },
  sessionCalendarSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  sessionSlotLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionJoinZoom: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  sessionJoinZoomText: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  sessionMeta: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
});
