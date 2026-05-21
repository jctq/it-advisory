'use client';

import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactElement } from 'react';

type CookieConsentSwitchProps = {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly id: string;
  readonly label: string;
  readonly onCheckedChange: (checked: boolean) => void;
};

/**
 * Accessible toggle for cookie preference categories.
 */
export function CookieConsentSwitch(props: CookieConsentSwitchProps): ReactElement {
  const buttonProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    id: props.id,
    type: 'button',
    role: 'switch',
    'aria-checked': props.checked,
    'aria-label': props.label,
    disabled: props.disabled,
    onClick: () => {
      if (!props.disabled) {
        props.onCheckedChange(!props.checked);
      }
    },
    className: cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      props.checked ? 'bg-primary' : 'bg-muted',
      props.disabled && 'cursor-not-allowed opacity-60',
    ),
  };
  return (
    <button {...buttonProps}>
      <span
        className={cn(
          'pointer-events-none inline-block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform',
          props.checked && 'translate-x-[1.35rem]',
        )}
      />
    </button>
  );
}
