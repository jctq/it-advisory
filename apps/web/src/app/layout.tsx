import type { Metadata } from 'next';
import Script from 'next/script';
import { Roboto, Roboto_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { brandAssetUrl } from '@/lib/brand/brand-assets';
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
        sizes: '382x354',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: brandAssetUrl('techmd-mark-dark.png'),
        type: 'image/png',
        sizes: '382x354',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: brandAssetUrl('techmd-mark-dark.png'),
        type: 'image/png',
        sizes: '382x354',
      },
    ],
    apple: [{ url: brandAssetUrl('techmd-mark-dark.png'), sizes: '382x354', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body className={`${sans.className} ${mono.variable} min-h-dvh antialiased`}>
        <Script src="/scripts/techmd-appearance-bootstrap.js" strategy="beforeInteractive" />
        <QueryProvider>
          {children}
          <Toaster closeButton position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
