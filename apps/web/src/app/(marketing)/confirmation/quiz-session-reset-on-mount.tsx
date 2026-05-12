'use client';

import { useEffect, useRef } from 'react';

const QUIZ_SESSION_API_URL = '/api/quiz/session';

export function QuizSessionResetOnMount(): null {
  const hasResetRef = useRef<boolean>(false);

  useEffect((): void => {
    if (hasResetRef.current) {
      return;
    }
    hasResetRef.current = true;
    void fetch(QUIZ_SESSION_API_URL, {
      method: 'DELETE',
    });
  }, []);

  return null;
}
