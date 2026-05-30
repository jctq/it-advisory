import type { Metadata } from 'next';
import { Roboto, Roboto_Mono } from 'next/font/google';
import { AppTopLoader } from '@/components/providers/app-top-loader';
import { RootAppearanceHydrator } from '@/components/providers/root-appearance-hydrator';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { brandAssetUrl } from '@/lib/brand/brand-assets';
import { resolveRootLayoutDocumentAppearance } from '@/lib/brand/resolve-root-layout-document-appearance';
import { buildRootLayoutMetadata, resolveMetadataBase } from '@/lib/seo/site-seo';
import './globals.css';

const sans = Roboto({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const mono = Roboto_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  ...buildRootLayoutMetadata(),
  icons: {
    icon: [
      {
        url: brandAssetUrl('techmd-mark.png'),
        type: 'image/png',
        sizes: '326x344',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: brandAssetUrl('techmd-mark-dark.png'),
        type: 'image/png',
        sizes: '326x344',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: brandAssetUrl('techmd-mark-dark.png'),
        type: 'image/png',
        sizes: '326x344',
      },
    ],
    apple: [{ url: brandAssetUrl('techmd-mark-dark.png'), sizes: '326x344', type: 'image/png' }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await resolveRootLayoutDocumentAppearance();
  return (
    <html
      lang="en-PH"
      className={appearance.isDark ? 'dark' : undefined}
      data-color-theme={appearance.colorTheme}
      style={{
        colorScheme: appearance.isDark ? 'dark' : 'light',
        backgroundColor: appearance.backgroundColor,
      }}
      suppressHydrationWarning
    >
      <body className={`${sans.className} ${mono.variable} min-h-dvh antialiased`}>
        <RootAppearanceHydrator />
        <AppTopLoader />
        <QueryProvider>
          {children}
          <Toaster closeButton position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
