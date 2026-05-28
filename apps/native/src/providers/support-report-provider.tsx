import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactElement,
  type RefObject,
} from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { readOrCreateDeviceId } from '../lib/device-id';
import { readNativeAppConfig } from '../lib/native-app-config';
import {
  normalizePhilippineMobileNationalDigits,
  parseGuestSupportReportContact,
  submitSupportReport,
} from '../lib/submit-support-report';
import { SupportReportFab } from '../components/support-report-fab';
import { SupportReportModal } from '../components/support-report-modal';
import { useSupportModuleEnabled } from '../hooks/use-support-module-enabled';
import { useMarketingAuth } from './marketing-auth-provider';

const MIN_MESSAGE_LENGTH = 3;

type SupportReportContextValue = {
  readonly registerScreenCaptureRef: (ref: RefObject<View | null>) => void;
  readonly openReportModal: () => void;
};

const SupportReportContext = createContext<SupportReportContextValue | null>(null);

export function useSupportReport(): SupportReportContextValue {
  const context = useContext(SupportReportContext);
  if (context === null) {
    throw new Error('useSupportReport must be used within SupportReportProvider.');
  }
  return context;
}

const EMPTY_CAPTURE_REF: RefObject<View | null> = { current: null };

/**
 * Registers the active screen root view for screenshot capture.
 */
export function useSupportReportScreenCapture(ref: RefObject<View | null>): void {
  const { registerScreenCaptureRef } = useSupportReport();
  useEffect(() => {
    registerScreenCaptureRef(ref);
    return () => registerScreenCaptureRef(EMPTY_CAPTURE_REF);
  }, [ref, registerScreenCaptureRef]);
}

type SupportReportProviderProps = PropsWithChildren;

/**
 * Global support report flow: capture current screen, message form, API submit.
 */
export function SupportReportProvider(props: SupportReportProviderProps): ReactElement {
  const supportModuleEnabled = useSupportModuleEnabled();
  const pathname = usePathname();
  const { user, sessionToken } = useMarketingAuth();
  const activeCaptureRef = useRef<RefObject<View | null>>(EMPTY_CAPTURE_REF);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhoneNationalDigits, setReporterPhoneNationalDigits] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const registerScreenCaptureRef = useCallback((ref: RefObject<View | null>) => {
    activeCaptureRef.current = ref;
  }, []);
  const resolveCaptureTarget = useCallback((): View | null => {
    return activeCaptureRef.current.current;
  }, []);
  const executeCapture = useCallback(async (): Promise<void> => {
    const target = resolveCaptureTarget();
    if (target === null) {
      setCaptureError('Could not capture this screen.');
      setScreenshotUri(null);
      return;
    }
    setIsCapturing(true);
    setCaptureError(null);
    try {
      const uri = await captureRef(target, {
        format: 'png',
        quality: 0.92,
        result: 'tmpfile',
        snapshotContentContainer: false,
      });
      setScreenshotUri(uri);
    } catch {
      setCaptureError('Screenshot capture failed. You can still send your message.');
      setScreenshotUri(null);
    } finally {
      setIsCapturing(false);
    }
  }, [resolveCaptureTarget]);
  const resetModalState = useCallback(() => {
    setMessage('');
    setReporterName('');
    setReporterEmail('');
    setReporterPhoneNationalDigits('');
    setScreenshotUri(null);
    setCaptureError(null);
    setSubmitError(null);
    setIsCapturing(false);
    setIsSubmitting(false);
  }, []);
  const openReportModal = useCallback(() => {
    if (!supportModuleEnabled) {
      return;
    }
    resetModalState();
    setIsModalVisible(true);
    void executeCapture();
  }, [executeCapture, resetModalState, supportModuleEnabled]);
  const closeReportModal = useCallback(() => {
    setIsModalVisible(false);
    resetModalState();
  }, [resetModalState]);
  const executeSubmit = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
      setSubmitError(`Please enter at least ${MIN_MESSAGE_LENGTH} characters.`);
      return;
    }
    const isGuest = user === null;
    let guestContact: { readonly reporterName: string; readonly reporterEmail: string; readonly reporterMobile: string } | null =
      null;
    if (isGuest) {
      const parsedContact = parseGuestSupportReportContact({
        reporterName,
        reporterEmail,
        reporterMobile: reporterPhoneNationalDigits,
      });
      if (!parsedContact.ok) {
        setSubmitError(parsedContact.error);
        return;
      }
      guestContact = parsedContact.contact;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const deviceId = await readOrCreateDeviceId();
      const { apiBaseUrl } = readNativeAppConfig();
      const result = await submitSupportReport({
        apiBaseUrl,
        message: trimmedMessage,
        route: pathname,
        screenshotUri,
        deviceId,
        reporterEmail: isGuest ? guestContact?.reporterEmail ?? null : user?.email ?? null,
        reporterName: guestContact?.reporterName ?? null,
        reporterMobile: guestContact?.reporterMobile ?? null,
        sessionToken,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      closeReportModal();
    } catch {
      setSubmitError('Failed to submit report. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    closeReportModal,
    message,
    pathname,
    reporterEmail,
    reporterName,
    reporterPhoneNationalDigits,
    screenshotUri,
    sessionToken,
    user,
  ]);
  const contextValue = useMemo<SupportReportContextValue>(
    () => ({
      registerScreenCaptureRef,
      openReportModal,
    }),
    [openReportModal, registerScreenCaptureRef],
  );
  return (
    <SupportReportContext.Provider value={contextValue}>
      {supportModuleEnabled ? (
        <>
          <SupportReportFab />
          <SupportReportModal
            captureError={captureError}
            isCapturing={isCapturing}
            isGuest={user === null}
            isSubmitting={isSubmitting}
            isVisible={isModalVisible}
            message={message}
            reporterEmail={reporterEmail}
            reporterName={reporterName}
            reporterPhoneNationalDigits={reporterPhoneNationalDigits}
            onChangeMessage={setMessage}
            onChangeReporterEmail={setReporterEmail}
            onChangeReporterName={setReporterName}
            onChangeReporterPhoneNationalDigits={(value) =>
              setReporterPhoneNationalDigits(normalizePhilippineMobileNationalDigits(value))
            }
            onClose={closeReportModal}
            onRetryCapture={() => void executeCapture()}
            onSubmit={() => void executeSubmit()}
            screenshotUri={screenshotUri}
            submitError={submitError}
          />
        </>
      ) : null}
      {props.children}
    </SupportReportContext.Provider>
  );
}
