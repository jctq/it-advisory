import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/use-app-theme';

type ProgressBarProps = {
  readonly value: number;
};

/**
 * Simple progress indicator for the guided diagnostic flow.
 */
export function ProgressBar(props: ProgressBarProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: theme.primary,
            width: `${Math.max(0, Math.min(props.value, 100))}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
