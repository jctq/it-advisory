import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  createPaymentCheckoutSession,
  fetchPaymentConfigPublic,
  fetchPaymentTransactionStatus,
  type PaymentConfigPublic,
} from '@techmd/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@techmd/domain/payment-types';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ThemedText } from '../src/components/themed-text';
import { readNativeAppConfig } from '../src/lib/native-app-config';
import { useMarketingAuth } from '../src/providers/marketing-auth-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

const DEFAULT_SERVICE_KEY = 'project-rescue' as const;
const POLL_INTERVAL_MS = 2000;
const MAX_PAID_POLLS = 30;
const CANCEL_POLL_CAP = 10;

type PaymentPollOutcome =
  | { readonly kind: 'paid'; readonly meetingUrl: string | null }
  | { readonly kind: 'failed' }
  | { readonly kind: 'pending' };

async function waitUntilTransactionPaidOrTerminal(params: {
  readonly apiBaseUrl: string;
  readonly transactionId: string;
  readonly deviceId?: string | null;
  readonly marketingSessionToken?: string | null;
  readonly maxPolls?: number;
}): Promise<PaymentPollOutcome> {
  const maxPolls = params.maxPolls ?? MAX_PAID_POLLS;
  for (let polls = 0; polls < maxPolls; polls += 1) {
    if (polls > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }
    const result = await fetchPaymentTransactionStatus({
      apiBaseUrl: params.apiBaseUrl,
      transactionId: params.transactionId,
      deviceId: params.deviceId,
      marketingSessionToken: params.marketingSessionToken,
    });
    if (result.status === 'paid') {
      return { kind: 'paid', meetingUrl: result.meetingUrl };
    }
    if (result.status === 'failed' || result.status === 'expired') {
      return { kind: 'failed' };
    }
  }
  return { kind: 'pending' };
}

export default function BookingCheckoutScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{
    date?: string;
    time?: string;
    name?: string;
    email?: string;
    company?: string;
    phone?: string;
  }>();
  const { apiBaseUrl } = useMemo(() => readNativeAppConfig(), []);
  const { deviceId, sessionToken } = useMarketingAuth();
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigPublic | null>(null);
  const [gatewayId, setGatewayId] = useState<PaymentGatewayId | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const date = typeof params.date === 'string' ? params.date : '';
  const time = typeof params.time === 'string' ? params.time : '';
  const customerName = typeof params.name === 'string' ? params.name : '';
  const customerEmail = typeof params.email === 'string' ? params.email : '';
  const customerCompany = typeof params.company === 'string' ? params.company : '';
  const customerPhone = typeof params.phone === 'string' ? params.phone : '';
  const selectedGateway = useMemo(() => {
    if (paymentConfig === null || gatewayId === null) {
      return null;
    }
    return paymentConfig.gateways.find((gateway) => gateway.id === gatewayId) ?? null;
  }, [paymentConfig, gatewayId]);
  const availableMethods = selectedGateway?.methods ?? [];
  useEffect(() => {
    if (apiBaseUrl.length === 0) {
      setLoadStatus('error');
      setLoadError('Set EXPO_PUBLIC_API_BASE_URL to your web API origin.');
      return;
    }
    void fetchPaymentConfigPublic({ apiBaseUrl })
      .then((config) => {
        setPaymentConfig(config);
        const firstGateway = config.gateways[0];
        if (firstGateway !== undefined) {
          setGatewayId(firstGateway.id);
          setPaymentMethodId(firstGateway.methods[0]?.id ?? null);
        }
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        setLoadStatus('error');
        setLoadError(error instanceof Error ? error.message : 'Failed to load payment options.');
      });
  }, [apiBaseUrl]);
  useEffect(() => {
    if (availableMethods.length === 0) {
      setPaymentMethodId(null);
      return;
    }
    const stillValid = availableMethods.some((method) => method.id === paymentMethodId);
    if (!stillValid) {
      setPaymentMethodId(availableMethods[0]!.id);
    }
  }, [availableMethods, paymentMethodId]);
  const executePay = async (): Promise<void> => {
    if (gatewayId === null || paymentMethodId === null || date.length === 0 || time.length === 0) {
      return;
    }
    const methodOption = availableMethods.find((method) => method.id === paymentMethodId);
    setIsPaying(true);
    setLoadError(null);
    try {
      const session = await createPaymentCheckoutSession({
        apiBaseUrl,
        appBaseUrl: apiBaseUrl,
        nativeInAppPaymentReturn: true,
        deviceId,
        marketingSessionToken: sessionToken,
        gatewayId,
        paymentMethodId,
        date,
        time,
        serviceKey: DEFAULT_SERVICE_KEY,
        customerName,
        customerEmail,
        customerPhone,
        customerCompany: customerCompany.length > 0 ? customerCompany : undefined,
        paymentMethodLabel: methodOption?.label,
      });
      if (session.manualConfirm || session.redirectUrl === null) {
        router.replace({
          pathname: '/confirmation',
          params: { date, time },
        });
        return;
      }
      const paymentReturnUrlPrefix = `${apiBaseUrl.replace(/\/$/, '')}/book/payment/native-close`;
      const browserResult = await WebBrowser.openAuthSessionAsync(session.redirectUrl, paymentReturnUrlPrefix);
      let transactionId = session.transactionId;
      if (browserResult.type === 'success' && browserResult.url !== undefined) {
        try {
          const parsedReturn = new URL(browserResult.url);
          const fromQuery = parsedReturn.searchParams.get('transactionId')?.trim() ?? '';
          if (fromQuery.length > 0) {
            transactionId = fromQuery;
          }
        } catch {
          /* ignore malformed return URL */
        }
      }
      const shouldPollForPaid =
        browserResult.type === 'success' || browserResult.type === 'dismiss' || browserResult.type === 'cancel';
      if (shouldPollForPaid) {
        const maxPolls = browserResult.type === 'cancel' ? CANCEL_POLL_CAP : MAX_PAID_POLLS;
        const outcome = await waitUntilTransactionPaidOrTerminal({
          apiBaseUrl,
          transactionId,
          deviceId,
          marketingSessionToken: sessionToken,
          maxPolls,
        });
        if (outcome.kind === 'paid') {
          const meeting = outcome.meetingUrl?.trim() ?? '';
          router.replace({
            pathname: '/confirmation',
            params: {
              date,
              time,
              ...(meeting.length > 0 ? { meetingUrl: meeting } : {}),
            },
          });
          return;
        }
      }
      setLoadError('Payment was not completed. Try again or use the web checkout.');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };
  return (
    <AppScreen
      title="Payment"
      subtitle={
        paymentConfig?.checkoutAmountLabel !== undefined
          ? `Amount due: ${paymentConfig.checkoutAmountLabel}`
          : 'Choose gateway and payment method.'
      }
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            busy={isPaying}
            disabled={gatewayId === null || paymentMethodId === null || loadStatus !== 'ready'}
            iconName="card-outline"
            onPress={() => void executePay()}
            showTrailingIcon
          >
            Continue to payment
          </AppButton>
          <AppButton iconName="arrow-back-outline" onPress={() => router.back()} variant="secondary">
            Back
          </AppButton>
        </View>
      }
    >
      {loadStatus === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textMuted }]}>Loading payment options…</ThemedText>
        </View>
      ) : null}
      {loadError !== null ? <ThemedText style={[styles.errorText, { color: theme.danger }]}>{loadError}</ThemedText> : null}
      <AppCard>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Payment gateway</ThemedText>
        {paymentConfig?.gateways.map((gateway) => {
          const isSelected = gatewayId === gateway.id;
          return (
            <Pressable
              key={gateway.id}
              onPress={() => {
                setGatewayId(gateway.id);
                setPaymentMethodId(gateway.methods[0]?.id ?? null);
              }}
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
              <ThemedText style={[styles.choiceTitle, { color: theme.text }]}>{gateway.label}</ThemedText>
              <ThemedText style={[styles.choiceBody, { color: theme.textMuted }]}>{gateway.description}</ThemedText>
            </Pressable>
          );
        })}
      </AppCard>
      {availableMethods.length > 0 ? (
        <AppCard>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Payment method</ThemedText>
          {availableMethods.map((method) => {
            const isSelected = paymentMethodId === method.id;
            return (
              <Pressable
                key={method.id}
                onPress={() => setPaymentMethodId(method.id)}
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
                <ThemedText style={[styles.choiceTitle, { color: theme.text }]}>{method.label}</ThemedText>
                <ThemedText style={[styles.choiceBody, { color: theme.textMuted }]}>{method.hint}</ThemedText>
              </Pressable>
            );
          })}
        </AppCard>
      ) : null}
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
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceButton: {
    borderRadius: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
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
