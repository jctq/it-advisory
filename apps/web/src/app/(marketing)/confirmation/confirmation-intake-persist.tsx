'use client';

import { useEffect, useRef } from 'react';

const QUIZ_SESSION_API_URL = '/api/quiz/session';
const BOOKINGS_API_URL = '/api/bookings';

type ConfirmationIntakePersistProps = {
  readonly date: string;
  readonly time: string;
};

/**
 * Persists the booking (including guided diagnostic snapshot) then clears quiz session state once.
 */
export function ConfirmationIntakePersist(props: ConfirmationIntakePersistProps): null {
  const hasRunRef = useRef<boolean>(false);
  useEffect((): void => {
    if (hasRunRef.current) {
      return;
    }
    if (props.date.trim().length === 0 || props.time.trim().length === 0) {
      return;
    }
    hasRunRef.current = true;
    void (async (): Promise<void> => {
      try {
        const response = await fetch(BOOKINGS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: props.date,
            time: props.time,
            serviceKey: 'project-rescue',
          }),
        });
        if (response.ok) {
          await fetch(QUIZ_SESSION_API_URL, { method: 'DELETE' });
        }
      } catch {
        /* non-fatal: confirmation UI still renders */
      }
    })();
  }, [props.date, props.time]);
  return null;
}
