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
      subtitle="Optional — attach guided diagnostics to your email from the Profile tab if you want."
      footer={
        <View style={styles.footerGroup}>
          <AppButton
            busy={isSubmitting}
            disabled={email.trim().length === 0 || password.length === 0}
            iconName="log-in-outline"
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
            Sign in
          </AppButton>
          <AppButton iconName="person-add-outline" onPress={() => router.push('/register')} variant="secondary">
            Create an account
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
