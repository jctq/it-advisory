import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/use-app-theme';

type AppCardProps = PropsWithChildren<{
  readonly tone?: 'brand' | 'default';
  /** Expands vertically inside a flex parent so inner lists can use flex: 1. */
  readonly fillVertical?: boolean;
}>;

/**
 * Shared elevated content container for the native app.
 */
export function AppCard(props: AppCardProps) {
  const theme = useAppTheme();
  const tone = props.tone ?? 'default';
  const isBrand = tone === 'brand';
  const fillVertical: boolean = props.fillVertical === true;

  return (
    <View
      style={[
        styles.card,
        isBrand ? styles.cardBrand : styles.cardDefault,
        fillVertical ? styles.cardFill : null,
        {
          backgroundColor: isBrand ? theme.primary : theme.surface,
          shadowColor: isBrand ? theme.primary : '#120C33',
        },
      ]}
    >
      {isBrand ? <View pointerEvents="none" style={styles.brandSheen} /> : null}
      {!isBrand ? <View pointerEvents="none" style={[styles.cardRim, { borderColor: theme.border }]} /> : null}
      <View style={[styles.inner, fillVertical ? styles.innerFill : null]}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
  },
  inner: {
    padding: 22,
    position: 'relative',
  },
  cardFill: {
    flex: 1,
    minHeight: 0,
  },
  innerFill: {
    flex: 1,
    minHeight: 0,
  },
  brandSheen: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    height: 1,
    left: 22,
    position: 'absolute',
    right: 22,
    top: 1,
    zIndex: 1,
  },
  cardRim: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    opacity: 0.65,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cardDefault: {
    borderWidth: 0,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 5,
  },
  cardBrand: {
    borderWidth: 0,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.28,
    shadowRadius: 36,
    elevation: 10,
  },
});
