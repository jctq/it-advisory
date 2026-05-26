'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  buildAdminOnboardingDriveSteps,
  hasSeenAdminOnboardingWelcome,
  markAdminOnboardingWelcomeSeen,
  resolveAdminOnboardingStepDefinition,
  shouldCloseMobileSidebarForOnboardingStep,
} from '@/lib/admin/admin-onboarding';
import { AdminOnboardingWelcomeDialog } from '@/components/admin/admin-onboarding-welcome-dialog';

type AdminOnboardingContextValue = {
  readonly isWelcomeOpen: boolean;
  readonly isTourActive: boolean;
  readonly startTour: () => void;
  readonly openWelcome: () => void;
};

const AdminOnboardingContext = createContext<AdminOnboardingContextValue | null>(null);

type AdminOnboardingProviderProps = {
  readonly children: ReactNode;
  /** Expands sidebar / opens mobile drawer so tour targets are visible. */
  readonly onPrepareTour?: () => void;
  readonly onOpenMobileSidebar?: () => void;
  readonly onCloseMobileSidebar?: () => void;
};

const MOBILE_SIDEBAR_TRANSITION_MS = 220;

function isMobileAdminViewport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(max-width: 767px)').matches;
}

function resolvePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AdminOnboardingProvider(props: AdminOnboardingProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef<string>(pathname);
  const driverRef = useRef<Driver | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const executeDestroyDriver = useCallback((): void => {
    driverRef.current?.destroy();
    driverRef.current = null;
    setIsTourActive(false);
  }, []);
  const executeSyncMobileSidebarForStep = useCallback(
    (stepIndex: number): void => {
      if (!isMobileAdminViewport()) {
        return;
      }
      const stepDefinition = resolveAdminOnboardingStepDefinition(stepIndex);
      if (stepDefinition === undefined) {
        return;
      }
      const shouldClose = shouldCloseMobileSidebarForOnboardingStep(stepDefinition.target);
      if (shouldClose) {
        props.onCloseMobileSidebar?.();
      } else {
        props.onOpenMobileSidebar?.();
      }
      window.setTimeout(() => {
        driverRef.current?.refresh();
      }, MOBILE_SIDEBAR_TRANSITION_MS);
    },
    [props.onCloseMobileSidebar, props.onOpenMobileSidebar],
  );
  const executeStartTour = useCallback((): void => {
    executeDestroyDriver();
    props.onPrepareTour?.();
    const prefersReducedMotion = resolvePrefersReducedMotion();
    const driverInstance = driver({
      showProgress: true,
      animate: !prefersReducedMotion,
      smoothScroll: !prefersReducedMotion,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'admin-driver-popover',
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: buildAdminOnboardingDriveSteps(router, () => pathnameRef.current),
      onHighlighted: (_element, _step, { state }) => {
        const stepIndex = state.activeIndex;
        if (stepIndex === undefined) {
          return;
        }
        executeSyncMobileSidebarForStep(stepIndex);
      },
      onDestroyed: () => {
        driverRef.current = null;
        setIsTourActive(false);
        markAdminOnboardingWelcomeSeen();
        if (isMobileAdminViewport()) {
          props.onCloseMobileSidebar?.();
        }
      },
    });
    driverRef.current = driverInstance;
    setIsTourActive(true);
    window.requestAnimationFrame(() => {
      driverInstance.drive();
    });
  }, [executeDestroyDriver, executeSyncMobileSidebarForStep, props.onCloseMobileSidebar, props.onPrepareTour, router]);
  const executeDismissWelcome = useCallback((): void => {
    setIsWelcomeOpen(false);
    markAdminOnboardingWelcomeSeen();
  }, []);
  const executeStartTourFromWelcome = useCallback((): void => {
    setIsWelcomeOpen(false);
    markAdminOnboardingWelcomeSeen();
    executeStartTour();
  }, [executeStartTour]);
  const executeOpenWelcome = useCallback((): void => {
    setIsWelcomeOpen(true);
  }, []);
  useEffect(() => {
    if (hasSeenAdminOnboardingWelcome()) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setIsWelcomeOpen(true);
    }, 400);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);
  useEffect(() => {
    return () => {
      executeDestroyDriver();
    };
  }, [executeDestroyDriver]);
  const contextValue = useMemo<AdminOnboardingContextValue>(
    () => ({
      isWelcomeOpen,
      isTourActive,
      startTour: executeStartTour,
      openWelcome: executeOpenWelcome,
    }),
    [executeOpenWelcome, executeStartTour, isTourActive, isWelcomeOpen],
  );
  return (
    <AdminOnboardingContext.Provider value={contextValue}>
      {props.children}
      <AdminOnboardingWelcomeDialog
        open={isWelcomeOpen}
        onOpenChange={setIsWelcomeOpen}
        onStartTour={executeStartTourFromWelcome}
        onDismiss={executeDismissWelcome}
      />
    </AdminOnboardingContext.Provider>
  );
}

export function useAdminOnboarding(): AdminOnboardingContextValue {
  const context = useContext(AdminOnboardingContext);
  if (context === null) {
    throw new Error('useAdminOnboarding must be used within AdminOnboardingProvider');
  }
  return context;
}
