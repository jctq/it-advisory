import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useAppTheme } from '../src/theme/use-app-theme';

export default function BookingDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ date?: string; time?: string }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const time = typeof params.time === 'string' ? params.time : '';
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  return (
    <AppScreen
      title="Your details"
      subtitle="We will use this information for your booking confirmation."
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            onPress={() => {
              if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || phone.trim().length < 7) {
                setErrorMessage('Enter your name, a valid email, and phone number.');
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
                  phone: phone.trim(),
                },
              });
            }}
          >
            Continue to payment
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.back()}>
            Back
          </AppButton>
        </View>
      }
    >
      {errorMessage !== null ? <Text style={[styles.errorText, { color: theme.danger }]}>{errorMessage}</Text> : null}
      <AppCard>
        <Text style={[styles.label, { color: theme.textMuted }]}>Full name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          autoCapitalize="words"
        />
        <Text style={[styles.label, { color: theme.textMuted }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={[styles.label, { color: theme.textMuted }]}>Company (optional)</Text>
        <TextInput
          value={company}
          onChangeText={setCompany}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <Text style={[styles.label, { color: theme.textMuted }]}>Phone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          keyboardType="phone-pad"
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  footerGroup: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  errorText: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
  },
});
