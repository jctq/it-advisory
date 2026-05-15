import { useFocusEffect } from '@react-navigation/native';
import type { MarketingAuthUser } from '@techmd/api-client/marketing-auth-api-client';
import {
  buildPhilippineMobileE164FromNationalDigits,
  normalizePhilippineMobileNationalDigits,
  parseNationalDigitsFromStoredPhone,
} from '@techmd/domain/philippine-mobile-phone';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ThemedText } from '../src/components/themed-text';
import { useMarketingAuth } from '../src/providers/marketing-auth-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

export default function BookingDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { executeRefreshUser } = useMarketingAuth();
  const params = useLocalSearchParams<{ date?: string; time?: string }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const time = typeof params.time === 'string' ? params.time : '';
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [phoneNationalDigits, setPhoneNationalDigits] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const applyFormFromUser = useCallback((nextUser: MarketingAuthUser | null) => {
    if (nextUser === null) {
      setName('');
      setEmail('');
      setCompany('');
      setPhoneNationalDigits('');
      return;
    }
    setName(nextUser.fullName?.trim() ?? '');
    setEmail(nextUser.email.trim());
    setCompany(nextUser.company?.trim() ?? '');
    setPhoneNationalDigits(parseNationalDigitsFromStoredPhone(nextUser.phone));
  }, []);
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void (async () => {
        try {
          const freshUser = await executeRefreshUser();
          if (!isActive) {
            return;
          }
          if (freshUser !== null) {
            applyFormFromUser(freshUser);
          }
        } catch {
          /* keep existing fields if the session refresh fails */
        }
      })();
      return () => {
        isActive = false;
      };
    }, [applyFormFromUser, executeRefreshUser]),
  );
  return (
    <AppScreen
      title="Your details"
      subtitle="We will use this information for your booking confirmation."
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            iconName="card-outline"
            onPress={() => {
              const phoneE164 = buildPhilippineMobileE164FromNationalDigits(phoneNationalDigits);
              if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || phoneE164 === null) {
                setErrorMessage('Enter your name, a valid email, and a Philippine mobile number (+63 9xx xxx xxxx).');
                return;
              }
              setErrorMessage(null);
              router.push({
                pathname: '/booking-checkout',
                params: {
                  date,
                  time,
                  name: name.trim(),
                  email: email.trim(),
                  company: company.trim(),
                  phone: phoneE164,
                },
              });
            }}
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
      {errorMessage !== null ? <ThemedText style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</ThemedText> : null}
      <AppCard>
        <ThemedText style={[styles.label, styles.labelFirst, { color: theme.text }]}>Full name</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[
            styles.input,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          autoCapitalize="words"
        />
        <ThemedText style={[styles.label, { color: theme.text }]}>Email</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <ThemedText style={[styles.label, { color: theme.text }]}>Company (optional)</ThemedText>
        <TextInput
          value={company}
          onChangeText={setCompany}
          style={[
            styles.input,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />
        <ThemedText style={[styles.label, { color: theme.text }]}>Phone (PH)</ThemedText>
        <ThemedText style={[styles.fieldHint, { color: theme.textMuted }]}>
          +63 mobile only; leading 0 is dropped (09… → 9…).
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
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  labelFirst: {
    marginTop: 0,
  },
  fieldHint: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  phoneRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  phonePrefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
  },
});
