(() => {
  const root = document.documentElement;
  const validModes = ["light","dark","system"];
  const validThemes = ["indigo","emerald","amber","rose"];
  const adminDefaultMode = "system";
  const adminDefaultTheme = "indigo";
  const marketingDefaultMode = "light";
  const marketingDefaultTheme = "indigo";
  const adminModeKey = "techmd-admin-color-mode";
  const adminThemeKey = "techmd-admin-color-theme";
  const marketingModeKey = "techmd-marketing-color-mode";
  const marketingThemeKey = "techmd-marketing-color-theme";
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