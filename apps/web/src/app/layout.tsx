import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'IT Advisory',
  description: 'Solve the right technology problem — guided diagnostic and consultations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <body className={`${sans.className} ${mono.variable} min-h-dvh antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
