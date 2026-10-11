import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeSwitcher = ({ variant = 'default' }) => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { t } = useLanguage();

  const title = isDark
    ? t('theme_switch_to_light', 'Switch to Light Mode')
    : t('theme_switch_to_dark', 'Switch to Dark Mode');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center group ${
        variant === 'login'
          ? 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border border-slate-700 shadow-md'
          : 'bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-amber-500 border border-slate-200 dark:border-slate-700/60 shadow-xs'
      }`}
      title={title}
      aria-label={title}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 group-hover:scale-110 transition-transform duration-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 group-hover:-rotate-12 group-hover:scale-110 transition-transform duration-300" />
      )}
    </button>
  );
};
