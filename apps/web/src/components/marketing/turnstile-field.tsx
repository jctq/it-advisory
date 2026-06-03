'use client';

import Script from 'next/script';
import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly callback: (token: string) => void;
      readonly 'expired-callback'?: () => void;
      readonly 'error-callback'?: () => void;
      readonly theme?: 'light' | 'dark' | 'auto';
      readonly size?: 'normal' | 'compact' | 'flexible';
      readonly appearance?: 'always' | 'execute' | 'interaction-only';
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function readTurnstileSiteKeyFromEnv(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
}

export function isTurnstileSiteKeyConfigured(): boolean {
  return readTurnstileSiteKeyFromEnv().length > 0;
}

type TurnstileFieldProps = {
  readonly onTokenChange: (token: string | null) => void;
  readonly className?: string;
};

/**
 * Cloudflare Turnstile widget for public web forms. No-op when site key is unset.
 */
export function TurnstileField(props: TurnstileFieldProps): ReactElement | null {
  const siteKey = readTurnstileSiteKeyFromEnv();
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(props.onTokenChange);
  const [isScriptReady, setIsScriptReady] = useState<boolean>(false);
  useEffect(() => {
    onTokenChangeRef.current = props.onTokenChange;
  }, [props.onTokenChange]);
  const renderWidget = useCallback((): void => {
    if (siteKey.length === 0 || !isScriptReady || window.turnstile === undefined) {
      return;
    }
    const container = document.getElementById(containerId);
    if (container === null) {
      return;
    }
    if (widgetIdRef.current !== null) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      theme: 'auto',
      callback: (token: string) => {
        onTokenChangeRef.current(token);
      },
      'expired-callback': () => {
        onTokenChangeRef.current(null);
      },
      'error-callback': () => {
        onTokenChangeRef.current(null);
      },
    });
  }, [containerId, isScriptReady, siteKey]);
  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);
  if (siteKey.length === 0) {
    return null;
  }
  return (
    <>
      <Script src={TURNSTILE_SCRIPT_URL} strategy="afterInteractive" onReady={() => setIsScriptReady(true)} />
      <div id={containerId} className={props.className} />
    </>
  );
}

type UseTurnstileExecutorResult = {
  readonly isConfigured: boolean;
  readonly requestToken: () => Promise<string | null>;
  readonly TurnstileMount: () => ReactElement | null;
};

/**
 * Invisible Turnstile executor for programmatic token refresh before API calls.
 */
export function useTurnstileExecutor(): UseTurnstileExecutorResult {
  const siteKey = readTurnstileSiteKeyFromEnv();
  const containerId = useId().replace(/:/g, '');
  const widgetIdRef = useRef<string | null>(null);
  const tokenResolverRef = useRef<((token: string | null) => void) | null>(null);
  const [isScriptReady, setIsScriptReady] = useState<boolean>(false);
  const isConfigured = siteKey.length > 0;
  const ensureWidget = useCallback((): boolean => {
    if (!isConfigured || !isScriptReady || window.turnstile === undefined) {
      return false;
    }
    const container = document.getElementById(containerId);
    if (container === null) {
      return false;
    }
    if (widgetIdRef.current !== null) {
      return true;
    }
    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: siteKey,
      size: 'compact',
      appearance: 'execute',
      callback: (token: string) => {
        tokenResolverRef.current?.(token);
        tokenResolverRef.current = null;
      },
      'expired-callback': () => {
        tokenResolverRef.current?.(null);
        tokenResolverRef.current = null;
      },
      'error-callback': () => {
        tokenResolverRef.current?.(null);
        tokenResolverRef.current = null;
      },
    });
    return widgetIdRef.current !== null;
  }, [containerId, isConfigured, isScriptReady, siteKey]);
  useEffect(() => {
    ensureWidget();
    return () => {
      if (widgetIdRef.current !== null && window.turnstile !== undefined) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [ensureWidget]);
  const requestToken = useCallback(async (): Promise<string | null> => {
    if (!isConfigured) {
      return null;
    }
    if (!ensureWidget() || window.turnstile === undefined || widgetIdRef.current === null) {
      return null;
    }
    return new Promise<string | null>((resolve) => {
      tokenResolverRef.current = resolve;
      window.turnstile?.reset(widgetIdRef.current as string);
      window.turnstile?.execute(widgetIdRef.current as string);
    });
  }, [ensureWidget, isConfigured]);
  const TurnstileMount = useCallback((): ReactElement | null => {
    if (!isConfigured) {
      return null;
    }
    return (
      <>
        <Script src={TURNSTILE_SCRIPT_URL} strategy="afterInteractive" onReady={() => setIsScriptReady(true)} />
        <div id={containerId} className="sr-only" aria-hidden />
      </>
    );
  }, [containerId, isConfigured]);
  return { isConfigured, requestToken, TurnstileMount };
}
