import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSupportReport } from '../providers/support-report-provider';
import { useAppTheme } from '../theme/use-app-theme';

/**
 * Floating action button to open the support report modal.
 */
export function SupportReportFab() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { openReportModal } = useSupportReport();
  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 72 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report an issue"
        onPress={openReportModal}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Ionicons color={theme.primary} name="flag-outline" size={18} />
        <Text style={[styles.label, { color: theme.text }]}>Report</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    zIndex: 40,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#0A0618',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
