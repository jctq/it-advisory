'use client';

import NextTopLoader from 'nextjs-toploader';

export function AppTopLoader() {
  return (
    <NextTopLoader
      color="var(--primary)"
      height={3}
      showSpinner={false}
      shadow={false}
      easing="ease"
      speed={200}
    />
  );
}
