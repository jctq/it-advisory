'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

type AdminSessionProviderProps = {
  readonly children: ReactNode;
};

export function AdminSessionProvider(props: AdminSessionProviderProps): React.ReactElement {
  return <SessionProvider>{props.children}</SessionProvider>;
}
