'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { syncAppearanceCookiesFromLocalStorage } from '@/lib/brand/appearance-cookies';
import {
  syncAdminDocumentAppearanceFromStorage,
  syncMarketingDocumentAppearanceFromStorage,
} from '@/lib/admin/document-appearance';

/**
 * Applies appearance from localStorage before paint and mirrors values into cookies for SSR.
 */
export function RootAppearanceHydrator(): null {
  const pathname = usePathname();
  useLayoutEffect(() => {
    syncAppearanceCookiesFromLocalStorage(pathname);
    if (pathname.startsWith('/admin')) {
      syncAdminDocumentAppearanceFromStorage();
      return;
    }
    syncMarketingDocumentAppearanceFromStorage();
  }, [pathname]);
  return null;
}
