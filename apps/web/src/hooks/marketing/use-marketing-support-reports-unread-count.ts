'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/config/build-api-url';

const UNREAD_COUNT_API_URL = buildApiUrl('/api/support/my-reports/unread-count');

type UnreadCountResponse = {
  readonly unreadCount?: number;
  readonly error?: string;
};

/**
 * Polls unread support report count for signed-in marketing users (staff replies not yet opened).
 */
export function useMarketingSupportReportsUnreadCount(isEnabled: boolean): number {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const executeLoadUnreadCount = useCallback(async (): Promise<void> => {
    if (!isEnabled) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetch(UNREAD_COUNT_API_URL, { credentials: 'include' });
      const payload = (await response.json()) as UnreadCountResponse;
      if (!response.ok) {
        return;
      }
      setUnreadCount(typeof payload.unreadCount === 'number' ? payload.unreadCount : 0);
    } catch {
      // Ignore transient network errors for badge polling.
    }
  }, [isEnabled]);
  useEffect(() => {
    queueMicrotask(() => {
      void executeLoadUnreadCount();
    });
  }, [executeLoadUnreadCount, pathname]);
  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    const executeHandleFocus = (): void => {
      void executeLoadUnreadCount();
    };
    window.addEventListener('focus', executeHandleFocus);
    document.addEventListener('visibilitychange', executeHandleFocus);
    return () => {
      window.removeEventListener('focus', executeHandleFocus);
      document.removeEventListener('visibilitychange', executeHandleFocus);
    };
  }, [executeLoadUnreadCount, isEnabled]);
  return unreadCount;
}

export function formatSupportReportsUnreadBadgeCount(unreadCount: number): string {
  if (unreadCount > 9) {
    return '9+';
  }
  return String(unreadCount);
}
