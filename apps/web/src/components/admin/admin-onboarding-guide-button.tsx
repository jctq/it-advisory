'use client';

import { CircleHelp } from 'lucide-react';
import { useAdminOnboarding } from '@/components/admin/admin-onboarding-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminOnboardingGuideButtonProps = {
  readonly className?: string;
};

export function AdminOnboardingGuideButton(props: AdminOnboardingGuideButtonProps) {
  const { isTourActive, startTour } = useAdminOnboarding();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-admin-tour="guide-button"
      aria-label="Show admin guided tour"
      aria-pressed={isTourActive}
      disabled={isTourActive}
      className={cn(
        'h-9 shrink-0 gap-1.5 border-border/80 px-2.5 font-normal shadow-xs',
        props.className,
      )}
      onClick={startTour}
    >
      <CircleHelp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="hidden text-sm sm:inline">Guide</span>
    </Button>
  );
}
