import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from './themed-text';
import { AppButton } from './app-button';
import { useAppTheme } from '../theme/use-app-theme';
import { useAppTypography } from '../providers/app-typography-provider';

type SupportReportModalProps = {
  readonly captureError: string | null;
  readonly isCapturing: boolean;
  readonly isGuest: boolean;
  readonly isSubmitting: boolean;
  readonly isVisible: boolean;
  readonly message: string;
  readonly reporterEmail: string;
  readonly reporterName: string;
  readonly reporterPhoneNationalDigits: string;
  readonly onChangeMessage: (value: string) => void;
  readonly onChangeReporterEmail: (value: string) => void;
  readonly onChangeReporterName: (value: string) => void;
  readonly onChangeReporterPhoneNationalDigits: (value: string) => void;
  readonly onClose: () => void;
  readonly onRetryCapture: () => void;
  readonly onSubmit: () => void;
  readonly screenshotUri: string | null;
  readonly submitError: string | null;
};

/**
 * Modal form for describing an issue and submitting a screenshot + message.
 */
export function SupportReportModal(props: SupportReportModalProps) {
  const theme = useAppTheme();
  const typography = useAppTypography();
  const trimmedMessage = props.message.trim();
  const canSubmit = trimmedMessage.length >= 3 && !props.isCapturing && !props.isSubmitting;
  return (
    <Modal animationType="slide" transparent visible={props.isVisible} onRequestClose={props.onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: 'rgba(10, 6, 24, 0.45)' }]}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText style={[styles.title, { color: theme.text }]}>Report an issue</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textMuted }]}>
              We attach a screenshot of what you see on screen right now with your message.
            </ThemedText>
            <ThemedText style={[styles.label, { color: theme.text }]}>Screenshot preview</ThemedText>
            <View style={[styles.previewFrame, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
              {props.isCapturing ? (
                <ActivityIndicator color={theme.primary} />
              ) : props.screenshotUri !== null ? (
                <Image accessibilityLabel="Screenshot preview" resizeMode="contain" source={{ uri: props.screenshotUri }} style={styles.previewImage} />
              ) : (
                <ThemedText style={[styles.previewPlaceholder, { color: theme.textMuted }]}>
                  {props.captureError ?? 'No screenshot captured.'}
                </ThemedText>
              )}
            </View>
            {props.captureError !== null ? (
              <Pressable accessibilityRole="button" onPress={props.onRetryCapture} disabled={props.isCapturing}>
                <ThemedText style={[styles.retryLink, { color: theme.primary }]}>Retry capture</ThemedText>
              </Pressable>
            ) : null}
            {props.isGuest ? (
              <View style={[styles.contactBlock, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                <ThemedText style={[styles.contactTitle, { color: theme.text }]}>Your contact details</ThemedText>
                <ThemedText style={[styles.contactHint, { color: theme.textMuted }]}>
                  So we can follow up. Sign in to skip this next time.
                </ThemedText>
                <ThemedText style={[styles.label, { color: theme.text }]}>Full name</ThemedText>
                <TextInput
                  editable={!props.isSubmitting}
                  onChangeText={props.onChangeReporterName}
                  placeholder="Your name"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.singleLineInput,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.background,
                      color: theme.text,
                      fontFamily: typography.regular,
                    },
                  ]}
                  value={props.reporterName}
                />
                <ThemedText style={[styles.label, { color: theme.text }]}>Email</ThemedText>
                <TextInput
                  autoCapitalize="none"
                  editable={!props.isSubmitting}
                  keyboardType="email-address"
                  onChangeText={props.onChangeReporterEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.singleLineInput,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.background,
                      color: theme.text,
                      fontFamily: typography.regular,
                    },
                  ]}
                  value={props.reporterEmail}
                />
                <ThemedText style={[styles.label, { color: theme.text }]}>Mobile number</ThemedText>
                <View style={[styles.phoneRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <ThemedText style={[styles.phonePrefix, { color: theme.textMuted, borderColor: theme.border }]}>+63</ThemedText>
                  <TextInput
                    editable={!props.isSubmitting}
                    keyboardType="phone-pad"
                    onChangeText={props.onChangeReporterPhoneNationalDigits}
                    placeholder="9xx xxx xxxx"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.phoneInput,
                      {
                        color: theme.text,
                        fontFamily: typography.regular,
                      },
                    ]}
                    value={props.reporterPhoneNationalDigits}
                  />
                </View>
              </View>
            ) : null}
            <ThemedText style={[styles.label, { color: theme.text }]}>Your message</ThemedText>
            <TextInput
              editable={!props.isSubmitting}
              multiline
              onChangeText={props.onChangeMessage}
              placeholder="What went wrong? What were you trying to do?"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  color: theme.text,
                  fontFamily: typography.regular,
                },
              ]}
              textAlignVertical="top"
              value={props.message}
            />
            {props.submitError !== null ? (
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>{props.submitError}</ThemedText>
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            <AppButton variant="secondary" onPress={props.onClose} disabled={props.isSubmitting}>
              Cancel
            </AppButton>
            <AppButton busy={props.isSubmitting} disabled={!canSubmit} onPress={props.onSubmit}>
              Send report
            </AppButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
  },
  content: {
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  previewFrame: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 140,
    overflow: 'hidden',
    padding: 8,
  },
  previewImage: {
    height: 160,
    width: '100%',
  },
  previewPlaceholder: {
    fontSize: 14,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  retryLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  contactBlock: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 14,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  contactHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  singleLineInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  phoneRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  phonePrefix: {
    borderRightWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
});
