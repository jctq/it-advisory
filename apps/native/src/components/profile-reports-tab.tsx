import {
  fetchMarketingMyReports,
  type MarketingSupportReportListStatusFilter,
  type MarketingSupportReportSummary,
} from '@techmd/api-client/marketing-my-reports-api-client';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppCard } from './app-card';
import { ThemedText } from './themed-text';
import { useAppTheme } from '../theme/use-app-theme';

const REPORTS_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: readonly { readonly id: MarketingSupportReportListStatusFilter; readonly label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting_reply', label: 'Awaiting' },
  { id: 'has_reply', label: 'Has reply' },
] as const;

type ProfileReportsTabProps = {
  readonly apiBaseUrl: string;
  readonly deviceId: string;
  readonly sessionToken: string;
};

function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Signed-in profile tab listing the user's support reports with search and filters.
 */
export function ProfileReportsTab(props: ProfileReportsTabProps): ReactElement {
  const theme = useAppTheme();
  const router = useRouter();
  const [reports, setReports] = useState<readonly MarketingSupportReportSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasAnyReports, setHasAnyReports] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<MarketingSupportReportListStatusFilter>('all');
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);
  const loadReports = useCallback(
    async (options: { readonly page: number; readonly append: boolean }): Promise<void> => {
      setError(null);
      if (options.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        const result = await fetchMarketingMyReports({
          apiBaseUrl: props.apiBaseUrl,
          deviceId: props.deviceId,
          marketingSessionToken: props.sessionToken,
          page: options.page,
          pageSize: REPORTS_PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
        });
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
        setHasAnyReports(result.hasAnyReports);
        setReports((previous) => (options.append ? [...previous, ...result.reports] : result.reports));
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reports.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [debouncedSearch, props.apiBaseUrl, props.deviceId, props.sessionToken, statusFilter],
  );
  useEffect(() => {
    void loadReports({ page: 1, append: false });
  }, [loadReports]);
  const executeLoadMore = (): void => {
    if (isLoadingMore || isLoading || page >= totalPages) {
      return;
    }
    void loadReports({ page: page + 1, append: true });
  };
  const renderReportRow = useCallback(
    ({ item }: { readonly item: MarketingSupportReportSummary }) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/account-report/${item.id}`)}
        style={({ pressed }) => [
          styles.reportRow,
          {
            borderColor: theme.border,
            backgroundColor: theme.surfaceMuted,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <ThemedText style={[styles.reportPreview, { color: theme.text }]}>{item.messagePreview}</ThemedText>
        <ThemedText style={[styles.reportRoute, { color: theme.textMuted }]}>{item.route}</ThemedText>
        <View style={styles.reportMetaRow}>
          <ThemedText style={[styles.reportMeta, { color: theme.textMuted }]}>
            {formatReportDate(item.createdAtIso)}
          </ThemedText>
          {item.hasUnreadStaffReply ? (
            <ThemedText style={[styles.reportBadge, { color: theme.primary }]}>New reply</ThemedText>
          ) : item.hasStaffReply ? (
            <ThemedText style={[styles.reportBadgeMuted, { color: theme.textMuted }]}>Has reply</ThemedText>
          ) : (
            <ThemedText style={[styles.reportBadgeMuted, { color: theme.textMuted }]}>Awaiting reply</ThemedText>
          )}
        </View>
      </Pressable>
    ),
    [router, theme.border, theme.primary, theme.surfaceMuted, theme.text, theme.textMuted],
  );
  const listHeader = (
    <View style={styles.headerBlock}>
      <TextInput
        accessibilityLabel="Search support reports"
        onChangeText={setSearchInput}
        placeholder="Search message, page, or ID"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.searchInput,
          {
            borderColor: theme.border,
            backgroundColor: theme.surfaceMuted,
            color: theme.text,
          },
        ]}
        value={searchInput}
      />
      <View style={styles.filterRow}>
        {STATUS_OPTIONS.map((option) => {
          const isActive = statusFilter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setStatusFilter(option.id)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.primary : theme.surfaceMuted,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.filterChipLabel,
                  { color: isActive ? theme.onPrimary : theme.text },
                ]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {isLoading && reports.length === 0 ? (
        <View style={styles.loaderRow}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText style={{ color: theme.textMuted, marginLeft: 12 }}>Loading reports…</ThemedText>
        </View>
      ) : null}
      {error !== null ? (
        <ThemedText style={[styles.error, { color: theme.danger }]}>{error}</ThemedText>
      ) : null}
      {!isLoading && !hasAnyReports ? (
        <ThemedText style={{ color: theme.textMuted }}>
          No support reports yet. Tap Report on any screen to send feedback with a screenshot.
        </ThemedText>
      ) : null}
      {!isLoading && hasAnyReports && reports.length === 0 && error === null ? (
        <ThemedText style={{ color: theme.textMuted }}>No reports match your filters.</ThemedText>
      ) : null}
    </View>
  );
  return (
    <AppCard fillVertical>
      <View style={styles.container}>
        <FlatList
          contentContainerStyle={styles.listContent}
          data={reports as MarketingSupportReportSummary[]}
          keyExtractor={(row: MarketingSupportReportSummary) => row.id}
          ListFooterComponent={
            reports.length > 0 ? (
              <ThemedText style={[styles.footerSummary, { color: theme.textMuted }]}>
                Showing {reports.length} of {totalCount} report{totalCount === 1 ? '' : 's'}
                {isLoadingMore ? ' · Loading…' : ''}
              </ThemedText>
            ) : null
          }
          ListHeaderComponent={listHeader}
          onEndReached={executeLoadMore}
          onEndReachedThreshold={0.35}
          renderItem={renderReportRow}
          showsVerticalScrollIndicator
          style={styles.list}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 8,
  },
  headerBlock: {
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  loaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  error: {
    fontSize: 14,
  },
  reportRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 14,
  },
  reportPreview: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  reportRoute: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  reportMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  reportMeta: {
    fontSize: 12,
  },
  reportBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportBadgeMuted: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerSummary: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
