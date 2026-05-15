import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { ThemedText } from '../src/components/themed-text';
import { useMarketingAuth } from '../src/providers/marketing-auth-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

/**
 * Optional marketing registration for saving progress to an account.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { executeRegister } = useMarketingAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  return (
    <AppScreen
      title="Create account"
      subtitle="Optional — merge on-device progress into this account from Profile when you sign in."
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            busy={isSubmitting}
            disabled={email.trim().length === 0 || password.length < 8}
            iconName="person-add-outline"
            onPress={() => {
              setErrorMessage(null);
              setIsSubmitting(true);
              void executeRegister(email.trim(), password)
                .then(() => {
                  router.back();
                })
                .catch((error: unknown) => {
                  setErrorMessage(error instanceof Error ? error.message : 'Registration failed.');
                })
                .finally(() => {
                  setIsSubmitting(false);
                });
            }}
          >
            Create account
          </AppButton>
          <AppButton iconName="log-in-outline" onPress={() => router.push('/login')} variant="secondary">
            Already have an account
          </AppButton>
          <AppButton onPress={() => router.back()} variant="ghost">
            Back
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <ThemedText style={[styles.label, { color: theme.text }]}>Email</ThemedText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@company.com"
          placeholderTextColor={theme.textMuted}
          style={[
            styles.input,
            {
              borderColor: theme.border,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
            },
          ]}
          value={email}
        />
        <ThemedText style={[styles.label, { color: theme.text, marginTop: 14 }]}>Password</ThemedText>
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          style={[
            styles.input,
            {
              borderColor: theme.border,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
            },
          ]}
          value={password}
        />
        {errorMessage !== null ? (
          <ThemedText style={[styles.error, { color: theme.danger }]}>{errorMessage}</ThemedText>
        ) : null}
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
    fontWeight: '700',
  },
  input: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    marginTop: 8,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});
