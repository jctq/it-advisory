'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminLogoutButtonProps = {
  readonly className?: string;
};

/**
 * Ends the admin NextAuth session and returns to the login page.
 */
export function AdminLogoutButton(props: AdminLogoutButtonProps): React.ReactElement {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-9 shrink-0 gap-1.5 border-border/80 px-2.5 font-normal shadow-xs',
        props.className,
      )}
      aria-label="Sign out"
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      <span className="hidden text-sm sm:inline">Sign out</span>
    </Button>
  );
}
