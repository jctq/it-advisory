import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useAppTypography } from '../providers/app-typography-provider';

function resolveFontFamily(typography: ReturnType<typeof useAppTypography>, flat: TextStyle | undefined): string | undefined {
  if (flat?.fontFamily !== undefined && flat.fontFamily.length > 0) {
    return flat.fontFamily;
  }
  const weight = flat?.fontWeight;
  const weightNum = typeof weight === 'number' ? weight : typeof weight === 'string' ? parseInt(weight, 10) : 400;
  const resolved = Number.isNaN(weightNum) ? 400 : weightNum;
  if (resolved >= 700) {
    return typography.bold;
  }
  if (resolved >= 600) {
    return typography.semibold;
  }
  if (resolved >= 500) {
    return typography.medium;
  }
  return typography.regular;
}

type ThemedTextProps = PropsWithChildren<TextProps>;

/**
 * Text that maps fontWeight to the matching Plus Jakarta Sans face when fonts are loaded.
 */
export function ThemedText(props: ThemedTextProps) {
  const typography = useAppTypography();
  const flatSource = props.style === undefined || props.style === null ? undefined : StyleSheet.flatten(props.style);
  const flat = flatSource as TextStyle | undefined;
  const fontFamily = resolveFontFamily(typography, flat);
  return <Text {...props} style={[props.style, fontFamily !== undefined ? { fontFamily } : null]} />;
}
