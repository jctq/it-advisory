import { cn } from '@/lib/utils';

const ACTION_BUTTON_DISABLED_BASE =
  'justify-center disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-100 disabled:shadow-none';

/** Primary admin action — solid primary when enabled, muted dashed when disabled. */
export function getAdminPrimaryActionButtonClass(widthClass: string): string {
  return cn(
    ACTION_BUTTON_DISABLED_BASE,
    widthClass,
    'disabled:border disabled:border-dashed disabled:border-muted-foreground/40 disabled:bg-muted/30 disabled:text-muted-foreground disabled:hover:bg-muted/30',
  );
}
