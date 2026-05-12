import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/use-app-theme';

/**
 * Shared elevated content container for the native app.
 */
export function AppCard(props: PropsWithChildren) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 2,
  },
});
