import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import {
  ADMIN_COLOR_MODES,
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEMES,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  DEFAULT_ADMIN_COLOR_MODE,
  DEFAULT_ADMIN_COLOR_THEME,
} from '@/lib/admin/admin-appearance';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
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

function resolveMetadataBase(): URL | undefined {
  const configuredOrigin = resolveConfiguredAppOrigin();
  if (configuredOrigin === null) {
    return undefined;
  }
  return new URL(configuredOrigin);
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'IT Advisory',
  description: 'Solve the right technology problem — guided diagnostic and consultations.',
};

const ADMIN_APPEARANCE_BOOTSTRAP_SCRIPT = `
(() => {
  if (!window.location.pathname.startsWith('/admin')) {
    return;
  }
  const root = document.documentElement;
  const validModes = ${JSON.stringify(ADMIN_COLOR_MODES)};
  const validThemes = ${JSON.stringify(ADMIN_COLOR_THEMES)};
  const defaultMode = ${JSON.stringify(DEFAULT_ADMIN_COLOR_MODE)};
  const defaultTheme = ${JSON.stringify(DEFAULT_ADMIN_COLOR_THEME)};
  const darkBackground = '#0f172a';
  const lightBackground = '#ffffff';
  try {
    const storedMode = window.localStorage.getItem(${JSON.stringify(ADMIN_COLOR_MODE_STORAGE_KEY)});
    const storedTheme = window.localStorage.getItem(${JSON.stringify(ADMIN_COLOR_THEME_STORAGE_KEY)});
    const mode = validModes.includes(storedMode) ? storedMode : defaultMode;
    const theme = validThemes.includes(storedTheme) ? storedTheme : defaultTheme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    const backgroundColor = isDark ? darkBackground : lightBackground;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.style.backgroundColor = backgroundColor;
    root.dataset.colorTheme = theme;
  } catch (error) {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    root.style.backgroundColor = lightBackground;
    root.dataset.colorTheme = defaultTheme;
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ADMIN_APPEARANCE_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={`${sans.className} ${mono.variable} min-h-dvh antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
