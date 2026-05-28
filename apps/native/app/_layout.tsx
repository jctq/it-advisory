import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { MarketingAuthProvider } from '../src/providers/marketing-auth-provider';
import { SupportReportProvider } from '../src/providers/support-report-provider';
import { DiagnosticFlowProvider } from '../src/providers/diagnostic-flow-provider';
import { AppTypographyProvider } from '../src/providers/app-typography-provider';
import { useAppTheme } from '../src/theme/use-app-theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * Root native layout with the shared diagnostic provider and stack navigation.
 */
export default function RootLayout() {
  const theme = useAppTheme();
  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.background }]}>
      <MarketingAuthProvider>
        <SupportReportProvider>
          <AppTypographyProvider>
            <DiagnosticFlowProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
            </DiagnosticFlowProvider>
          </AppTypographyProvider>
        </SupportReportProvider>
      </MarketingAuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
