import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
} from '../src/lib/admin/admin-appearance';

const outputDir = join(process.cwd(), 'public', 'scripts');
const outputPath = join(outputDir, 'techmd-appearance-bootstrap.js');

const script = `(() => {
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

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, script, 'utf8');
console.log(`Wrote ${outputPath}`);
