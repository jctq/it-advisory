import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { PropsWithChildren, ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/use-app-theme';
import { useAppTypography } from '../providers/app-typography-provider';

type AppButtonVariant = 'ghost' | 'primary' | 'secondary';

type AppButtonProps = PropsWithChildren<{
  readonly busy?: boolean;
  readonly compact?: boolean;
  readonly disabled?: boolean;
  readonly iconName?: keyof typeof Ionicons.glyphMap;
  readonly onPress?: () => void;
  readonly showTrailingIcon?: boolean;
  readonly variant?: AppButtonVariant;
}>;

/**
 * Primary actions use depth, haptics, and optional leading icon; secondary stays quiet but crisp.
 */
export function AppButton(props: AppButtonProps): ReactElement {
  const theme = useAppTheme();
  const typography = useAppTypography();
  const variant = props.variant ?? 'primary';
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDisabled = Boolean(props.disabled || props.busy);
  const isCompact = props.compact === true;
  const showTrailing = props.showTrailingIcon === true && isPrimary && !props.busy;
  const executePressIn = (): void => {
    if (isDisabled) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const labelColor = isPrimary ? theme.onPrimary : isSecondary ? theme.primary : theme.text;
  const iconTint = labelColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(props.busy), disabled: isDisabled }}
      disabled={isDisabled}
      onPress={props.onPress}
      onPressIn={executePressIn}
      style={({ pressed }) => [
        styles.base,
        isCompact ? styles.baseCompact : null,
        isPrimary ? styles.basePrimary : null,
        isSecondary ? styles.baseSecondary : null,
        isGhost ? styles.baseGhost : null,
        isCompact && isGhost ? styles.baseGhostCompact : null,
        isPrimary
          ? {
              backgroundColor: pressed && !isDisabled ? theme.primaryPressed : theme.primary,
              shadowColor: theme.primary,
            }
          : isSecondary
            ? {
                backgroundColor: pressed && !isDisabled ? theme.surfaceMuted : theme.surface,
                borderColor: theme.primary,
              }
            : {
                backgroundColor: pressed && !isDisabled ? theme.surfaceMuted : 'transparent',
              },
        { opacity: isDisabled ? 0.5 : 1, transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }] },
      ]}
    >
      <View style={styles.contentRow}>
        {props.busy ? (
          <ActivityIndicator color={labelColor} size="small" />
        ) : (
          <>
            {props.iconName !== undefined ? (
              <Ionicons
                color={iconTint}
                name={props.iconName}
                size={isCompact ? 18 : 20}
                style={styles.iconLeading}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                isCompact ? styles.labelCompact : null,
                {
                  color: labelColor,
                  fontFamily: typography.semibold,
                },
              ]}
            >
              {props.children}
            </Text>
            {showTrailing ? (
              <Ionicons color={iconTint} name="arrow-forward" size={18} style={styles.iconTrailing} />
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 0,
    justifyContent: 'center',
    minHeight: 54,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  baseCompact: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  basePrimary: {
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  baseSecondary: {
    borderWidth: 1.5,
    shadowColor: '#0A0618',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  baseGhost: {
    minHeight: 48,
    paddingVertical: 12,
  },
  baseGhostCompact: {
    minHeight: 40,
    paddingVertical: 8,
  },
  contentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  labelCompact: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  iconLeading: {
    marginRight: 2,
  },
  iconTrailing: {
    marginLeft: 2,
  },
});
