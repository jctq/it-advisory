import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../src/components/app-button';
import { AppCard } from '../src/components/app-card';
import { AppScreen } from '../src/components/app-screen';
import { useMarketingAuth } from '../src/providers/marketing-auth-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

/**
 * Optional marketing sign-in for syncing diagnostics to an account.
 */
export default function LoginScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { executeLogin } = useMarketingAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  return (
    <AppScreen
      title="Sign in"
      subtitle="Optional — continue anonymously from the home screen if you prefer."
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            disabled={isSubmitting || email.trim().length === 0 || password.length === 0}
            onPress={() => {
              setErrorMessage(null);
              setIsSubmitting(true);
              void executeLogin(email.trim(), password)
                .then(() => {
                  router.back();
                })
                .catch((error: unknown) => {
                  setErrorMessage(error instanceof Error ? error.message : 'Sign in failed.');
                })
                .finally(() => {
                  setIsSubmitting(false);
                });
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </AppButton>
          <AppButton onPress={() => router.push('/register')} variant="secondary">
            Create an account
          </AppButton>
          <AppButton onPress={() => router.back()} variant="ghost">
            Back
          </AppButton>
        </View>
      }
    >
      <AppCard>
        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
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
        <Text style={[styles.label, { color: theme.text, marginTop: 14 }]}>Password</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="Your password"
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
          <Text style={[styles.error, { color: theme.primary }]}>{errorMessage}</Text>
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
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});
