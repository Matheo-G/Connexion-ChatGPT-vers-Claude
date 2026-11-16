/**
 * @file Theme of extension pages (popup, options).
 * 'auto' follows the OS; 'light' / 'dark' force it (see tokens.css).
 */

/** @param {'auto' | 'light' | 'dark'} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}
