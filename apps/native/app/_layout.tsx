import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DiagnosticFlowProvider } from '../src/providers/diagnostic-flow-provider';

/**
 * Root native layout with the shared diagnostic provider and stack navigation.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <DiagnosticFlowProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </DiagnosticFlowProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
