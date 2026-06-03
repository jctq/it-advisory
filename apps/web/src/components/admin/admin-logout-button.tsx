'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

/**
 * Ends the admin NextAuth session and returns to the login page.
 */
export function AdminLogoutButton(): React.ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      aria-label="Sign out"
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
