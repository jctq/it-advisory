import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  createPaymentCheckoutSession,
  fetchPaymentConfigPublic,
  fetchPaymentTransactionStatus,
  type PaymentConfigPublic,
} from '@it-advisory/api-client/marketing-payment-api-client';
import type { PaymentGatewayId } from '@it-advisory/domain/payment-types';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useAppTheme } from '../src/theme/use-app-theme';

const DEFAULT_SERVICE_KEY = 'project-rescue' as const;

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
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
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
      const browserResult = await WebBrowser.openAuthSessionAsync(session.redirectUrl, `${apiBaseUrl}/book/payment/return`);
      if (browserResult.type === 'success' && browserResult.url !== undefined) {
        const returnUrl = new URL(browserResult.url);
        const transactionId = returnUrl.searchParams.get('transactionId') ?? session.transactionId;
        const status = await fetchPaymentTransactionStatus({ apiBaseUrl, transactionId });
        if (status.status === 'paid') {
          router.replace({ pathname: '/confirmation', params: { date, time } });
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
            disabled={gatewayId === null || paymentMethodId === null || isPaying || loadStatus !== 'ready'}
            onPress={() => void executePay()}
          >
            {isPaying ? 'Opening payment…' : 'Continue to payment'}
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.back()}>
            Back
          </AppButton>
        </View>
      }
    >
      {loadStatus === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading payment options…</Text>
        </View>
      ) : null}
      {loadError !== null ? <Text style={[styles.errorText, { color: theme.danger }]}>{loadError}</Text> : null}
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment gateway</Text>
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
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
            >
              <Text style={[styles.choiceTitle, { color: theme.text }]}>{gateway.label}</Text>
              <Text style={[styles.choiceBody, { color: theme.textMuted }]}>{gateway.description}</Text>
            </Pressable>
          );
        })}
      </AppCard>
      {availableMethods.length > 0 ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment method</Text>
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
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
              >
                <Text style={[styles.choiceTitle, { color: theme.text }]}>{method.label}</Text>
                <Text style={[styles.choiceBody, { color: theme.textMuted }]}>{method.hint}</Text>
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
    fontSize: 16,
    fontWeight: '800',
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
    fontWeight: '600',
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceButton: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
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
