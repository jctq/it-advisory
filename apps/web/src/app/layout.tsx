import type { Metadata } from 'next';
import { Roboto, Roboto_Mono } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import {
  ADMIN_COLOR_MODES,
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEMES,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  DEFAULT_ADMIN_COLOR_MODE,
  DEFAULT_ADMIN_COLOR_THEME,
  DEFAULT_MARKETING_COLOR_MODE,
  DEFAULT_MARKETING_COLOR_THEME,
  MARKETING_COLOR_MODE_STORAGE_KEY,
  MARKETING_COLOR_THEME_STORAGE_KEY,
} from '@/lib/admin/admin-appearance';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
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

function resolveMetadataBase(): URL | undefined {
  const configuredOrigin = resolveConfiguredAppOrigin();
  if (configuredOrigin === null) {
    return undefined;
  }
  return new URL(configuredOrigin);
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'TechMD — IT Advisory',
  description:
    'Technology consultation. Better decisions. Stronger business. Guided diagnostics and expert sessions.',
  icons: {
    icon: [
      {
        url: '/brand/techmd-mark.png',
        type: 'image/png',
        sizes: '382x354',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/brand/techmd-mark-dark.png',
        type: 'image/png',
        sizes: '382x354',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/brand/techmd-mark-dark.png',
        type: 'image/png',
        sizes: '382x354',
      },
    ],
    apple: [{ url: '/brand/techmd-mark-dark.png', sizes: '382x354', type: 'image/png' }],
  },
};

const ADMIN_APPEARANCE_BOOTSTRAP_SCRIPT = `
(() => {
  const root = document.documentElement;
  const validModes = ${JSON.stringify(ADMIN_COLOR_MODES)};
  const validThemes = ${JSON.stringify(ADMIN_COLOR_THEMES)};
  const adminDefaultMode = ${JSON.stringify(DEFAULT_ADMIN_COLOR_MODE)};
  const adminDefaultTheme = ${JSON.stringify(DEFAULT_ADMIN_COLOR_THEME)};
  const marketingDefaultMode = ${JSON.stringify(DEFAULT_MARKETING_COLOR_MODE)};
  const marketingDefaultTheme = ${JSON.stringify(DEFAULT_MARKETING_COLOR_THEME)};
  const adminModeKey = ${JSON.stringify(ADMIN_COLOR_MODE_STORAGE_KEY)};
  const adminThemeKey = ${JSON.stringify(ADMIN_COLOR_THEME_STORAGE_KEY)};
  const marketingModeKey = ${JSON.stringify(MARKETING_COLOR_MODE_STORAGE_KEY)};
  const marketingThemeKey = ${JSON.stringify(MARKETING_COLOR_THEME_STORAGE_KEY)};
  const darkBackground = '#0f172a';
  const lightBackground = '#ffffff';
  try {
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    const modeKey = isAdminRoute ? adminModeKey : marketingModeKey;
    const themeKey = isAdminRoute ? adminThemeKey : marketingThemeKey;
    const defaultMode = isAdminRoute ? adminDefaultMode : marketingDefaultMode;
    const defaultTheme = isAdminRoute ? adminDefaultTheme : marketingDefaultTheme;
    const storedMode = window.localStorage.getItem(modeKey);
    const storedTheme = window.localStorage.getItem(themeKey);
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
    root.dataset.colorTheme = marketingDefaultTheme;
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
