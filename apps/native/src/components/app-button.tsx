import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../theme/use-app-theme';

type AppButtonVariant = 'ghost' | 'primary' | 'secondary';

type AppButtonProps = PropsWithChildren<{
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly variant?: AppButtonVariant;
}>;

/**
 * Shared touch-friendly CTA with primary, secondary, and ghost variants.
 */
export function AppButton(props: AppButtonProps) {
  const theme = useAppTheme();
  const variant = props.variant ?? 'primary';
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary ? theme.primary : isSecondary ? theme.surface : 'transparent',
          borderColor: isPrimary ? theme.primary : theme.border,
          opacity: props.disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !props.disabled ? 0.985 : 1 }],
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: isPrimary ? '#FFFFFF' : theme.text,
          },
        ]}
      >
        {props.children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
